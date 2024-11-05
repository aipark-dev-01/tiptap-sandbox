// src/Tiptap.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import { Dispatch, Node } from '@tiptap/core'
import History from '@tiptap/extension-history'
import Document from '@tiptap/extension-document'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import Text from '@tiptap/extension-text'
import { useEffect } from 'react'

function getNextCursor(state: EditorState) {
  const { selection } = state
  const { $from } = selection

  let nextCursor = state.doc.resolve($from.pos + 1)
  while (nextCursor.nodeAfter?.type.name === 'space' || nextCursor.nodeAfter?.type.name === 'sentence') {
    nextCursor = state.doc.resolve(nextCursor.pos + 1)
  }

  return nextCursor
}

function getPrevCursor(state: EditorState) {
  const { selection } = state
  const { $from } = selection

  let prevCursor = state.doc.resolve($from.pos - 1)
  while (
    prevCursor.pos > 0 &&
    (prevCursor.nodeAfter?.type.name === 'space' ||
      prevCursor.nodeAfter?.type.name === 'sentence' ||
      prevCursor.nodeAfter?.type.name === 'paragraph')
  ) {
    prevCursor = state.doc.resolve(prevCursor.pos - 1)
  }

  return prevCursor
}

function goToNextCursor(state: EditorState, dispatch: Dispatch) {
  const { tr } = state
  const nextCursor = getNextCursor(state)

  tr.setSelection(TextSelection.create(tr.doc, nextCursor.pos))
  dispatch?.(tr.scrollIntoView())
}

function goToPrevCursor(state: EditorState, dispatch: Dispatch) {
  const { tr } = state
  const prevCursor = getPrevCursor(state)

  tr.setSelection(TextSelection.create(tr.doc, prevCursor.pos))
  dispatch?.(tr.scrollIntoView())
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraph: {
      goToLeftSentence: () => ReturnType
    }
    sentence: {
      splitSentence: () => ReturnType
      deleteCharacters: () => ReturnType
    }
  }
}

const Paragraph = Node.create({
  name: 'paragraph',

  group: 'block',

  content: '(sentence space)*',

  parseHTML() {
    return [{ tag: 'p' }]
  },

  renderHTML() {
    return ['p', { class: 'py-[30px]' }, 0]
  },

  addCommands() {
    return {
      goToLeftSentence:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state
          const { $from } = selection
          const parentNode = $from.parent

          // 커서가 paragraph에 있을 경우
          if (parentNode.type.name === 'paragraph') {
            goToPrevCursor(state, dispatch)
            return true
          }
          return false
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      ArrowLeft: ({ editor }) => editor.commands.goToLeftSentence(),
    }
  },
})

// Space 노드 정의
const Space = Node.create({
  name: 'space',
  inline: true,
  group: 'inline',
  selectable: false,
  atom: true, // 이 노드를 하나의 블록처럼 다루도록 설정

  parseHTML() {
    return [{ tag: 'span.space' }]
  },

  renderHTML() {
    return ['span', { class: 'space' }, '1.5'] // 시각적으로 공간을 제공
  },
})

// Sentence 노드에 명령어와 단축키 추가
const Sentence = Node.create({
  name: 'sentence',

  group: 'inline',
  inline: true,

  parseHTML() {
    return [{ tag: 'span.sentence' }]
  },

  renderHTML() {
    return ['span', { class: 'inline-block text-3xl border px-4 sentence' }, 0]
  },

  content: 'text*',

  addCommands() {
    return {
      splitSentence:
        () =>
        ({ state, dispatch }) => {
          const { selection, tr } = state
          const { $from, $to } = selection
          const parentNode = $from.parent

          console.log(
            'split',
            'pos',
            $from.pos,
            'start',
            $from.start(),
            'end',
            $from.end(),
            'before',
            $from.before(),
            'after',
            $from.after(),
            'posAtIndex',
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            $from.posAtIndex(),
            'index',
            $from.index(),
            'textOffset',
            $from.textOffset,
            'parentNode',
            parentNode.type.name
          )
          if ($from.pos === $to.pos) {
            // 현재 노드가 sentence인지 확인
            if (parentNode.type.name === 'sentence') {
              const offset = $from.parentOffset
              const nodeText = parentNode.textContent || ''

              // 커서가 마지막일 경우
              if (offset === nodeText.length) {
                // space나 sentence 만나면 다음커서로 지나가야됨. text(문장 중간에 커서 있었을 경우), paragraph(문장 마지막)를 만나야됨
                goToNextCursor(state, dispatch)
                return true
                // 커서가 중간일 경우
              } else if (offset > 0) {
                const sentenceType = state.schema.nodes.sentence

                // 텍스트를 커서 기준으로 두 부분으로 나누기
                const firstPart = nodeText.slice(0, offset)
                const secondPart = nodeText.slice(offset)

                // 새로운 sentence 노드를 생성하여 두 번째 부분 삽입
                const newSentenceNode = sentenceType.create({}, state.schema.text(secondPart))
                tr.insert($from.after(), newSentenceNode)

                // 기존 sentence를 첫 번째 부분으로 업데이트하고, 두 번째 부분으로 새 sentence 노드 추가
                tr.insertText(firstPart, $from.start(), $from.end()) // 기존 텍스트를 첫 번째 부분으로 수정

                // 새로운 텍스트가 삽입된 후, 커서를 다음 `sentence` 노드로 이동
                goToNextCursor(state, dispatch)
                return true
              } else if (offset === 0) {
                //! 가장 위험한 코드 - 커서 위치를 -1로 이동 (기본 엔터 동작 적용을 위해)
                const newPos = Math.max(0, $from.pos - 1) // 경계값 방지
                const transaction = state.tr.setSelection(TextSelection.create(state.doc, newPos))
                dispatch?.(transaction)
                return false
              }
            }
          }

          return false
        },
      deleteCharacters:
        () =>
        ({ state, dispatch }) => {
          const { selection, tr } = state
          const { $from, $to } = selection

          const parentNode = $from.parent

          console.log(
            'Delete',
            'pos',
            $from.pos,
            'start',
            $from.start(),
            'end',
            $from.end(),
            'before',
            $from.before(),
            'after',
            $from.after(),
            'posAtIndex',
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            $from.posAtIndex(),
            'index',
            $from.index(),
            'textOffset',
            $from.textOffset,
            'parentNode',
            parentNode.type.name
          )

          // 범위선택 안한 상태로 문장의 커서가 처음에 있을 때
          if ($from.pos === $to.pos) {
            if (parentNode.type.name === 'sentence' && $from.pos === $from.start()) {
              const prevCursor = getPrevCursor(state)
              tr.delete(prevCursor.pos, $from.pos) // space 노드 삭제
              dispatch?.(tr.scrollIntoView())
              return true
            }
            // 빈 커서에 있는 경우 (박스 생성 안돼있음)
            if (parentNode.type.name === 'paragraph') {
              if ($from.pos === $from.end()) {
                // 빈 문단 단독일 경우의 빈 커서인 경우
                if ($from.start() === $from.end()) {
                  return false
                }
                // 문장이 있는 상태로 마지막 빈 커서인 경우
                goToPrevCursor(state, dispatch)
                return true
              } else {
                // 커서가 문장사이 중간에 걸쳐있는 경우
                const prevCursor = getPrevCursor(state)
                const nextCursor = getNextCursor(state)
                tr.delete(prevCursor.pos, nextCursor.pos) // space 노드 삭제
                dispatch?.(tr.scrollIntoView())
                return true
              }
            }
          }

          return false
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => editor.commands.splitSentence(),
      Backspace: ({ editor }) => editor.commands.deleteCharacters(),
    }
  },
})

const content = `
<p>
<span class="sentence">01234</span>
<span class="space">a</span>
<span class="sentence">56789</span>
</p>
<p>
<span class="sentence">01234</span>
<span class="space">a</span>
<span class="sentence">56789</span>
</p>
`

const Tiptap: React.FC = () => {
  const editor = useEditor({
    extensions: [Document, Paragraph, Sentence, Text, Space, History],
    content,
  })

  useEffect(() => {}, [editor, editor?.state])

  return (
    <div className="p-10">
      <EditorContent editor={editor} className="border-none !focus-visible:outline-none" />
    </div>
  )
}

export default Tiptap
