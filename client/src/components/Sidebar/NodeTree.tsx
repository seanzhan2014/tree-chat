import { useState } from 'react';
import { ChevronRight, ChevronDown, MessageSquare, Trash2 } from 'lucide-react';
import type { TreeNode } from '../../types';
import { useAppStore, buildTree } from '../../store/appStore';
import { getSubtreeCount } from '../../services/api';
import ConfirmDialog from '../common/ConfirmDialog';

interface NodeItemProps {
  node: TreeNode;
  depth: number;
  selectedNodeId: number | null;
}

function NodeItem({ node, depth, selectedNodeId }: NodeItemProps) {
  const { selectNode, deleteNode, selectedTopicId } = useAppStore();
  const [expanded, setExpanded] = useState(true);
  const [confirm, setConfirm] = useState<{ count: number } | null>(null);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedNodeId === node.id;
  const displayName = node.node_name || node.user_content.slice(0, 20);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedTopicId) return;
    const { count } = await getSubtreeCount(node.id);
    setConfirm({ count });
  };

  const confirmDelete = async () => {
    setConfirm(null);
    await deleteNode(node.id);
  };

  return (
    <>
      {confirm && (
        <ConfirmDialog
          title="Delete node?"
          message={
            confirm.count > 0
              ? `This node has ${confirm.count} descendant${confirm.count > 1 ? 's' : ''}. They will all be deleted.`
              : 'This will permanently delete this conversation node.'
          }
          onConfirm={confirmDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div
        className={`group flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer select-none transition-colors text-xs
          ${isSelected
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
          }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => selectNode(node.id)}
      >
        {/* Expand/collapse toggle */}
        <button
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-60 hover:opacity-100"
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
        >
          {hasChildren
            ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : <span className="w-4" />
          }
        </button>

        <MessageSquare size={12} className="flex-shrink-0 opacity-50" />

        <span className="flex-1 truncate">{displayName}</span>

        {/* Delete button */}
        <button
          className="flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded hover:text-red-500"
          onClick={handleDelete}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <NodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </>
  );
}

interface Props {
  topicId: number;
}

export default function NodeTree({ topicId }: Props) {
  const { nodesByTopic, selectedNodeId } = useAppStore();
  const nodes = nodesByTopic[topicId] || [];

  const roots = buildTree(nodes);

  if (roots.length === 0) {
    return (
      <div className="px-4 py-2 text-xs text-gray-400 italic">No messages yet</div>
    );
  }

  return (
    <div className="py-1">
      {roots.map(node => (
        <NodeItem key={node.id} node={node} depth={0} selectedNodeId={selectedNodeId} />
      ))}
    </div>
  );
}
