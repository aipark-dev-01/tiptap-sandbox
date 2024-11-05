// src/SpanNodeView.tsx
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from '@tiptap/react'

type SpanNodeViewProps = NodeViewProps

const SpanNodeView = ({ node }: SpanNodeViewProps) => {
  const handleClick = () => {
    alert(`Clicked on: ${JSON.stringify(node)}`)
  }

  return (
    <NodeViewWrapper as="span" onClick={handleClick} style={{ cursor: 'pointer', color: 'blue' }}>
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

export default SpanNodeView
