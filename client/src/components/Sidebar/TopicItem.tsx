import { useState, useRef, useEffect } from 'react';
import { Plus, Minus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { Topic } from '../../types';
import NodeTree from './NodeTree';
import ConfirmDialog from '../common/ConfirmDialog';

interface Props {
  topic: Topic;
  onSelect?: () => void;
}

export default function TopicItem({ topic, onSelect }: Props) {
  const { selectedTopicId, expandedTopicIds, selectTopic, toggleTopicExpanded, renameTopic, deleteTopic } = useAppStore();
  const isSelected = selectedTopicId === topic.id;
  const isExpanded = expandedTopicIds.has(topic.id);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(topic.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const submitRename = async () => {
    if (editTitle.trim() && editTitle.trim() !== topic.title) {
      await renameTopic(topic.id, editTitle.trim());
    } else {
      setEditTitle(topic.title);
    }
    setEditing(false);
  };

  return (
    <div className="group/topic">
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl cursor-pointer select-none transition-colors
          ${isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/40 text-gray-700 dark:text-gray-300'
          }`}
        onClick={() => { if (!editing) { selectTopic(topic.id); onSelect?.(); } }}
      >
        {/* Expand toggle */}
        <button
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          title={isExpanded ? 'Collapse tree' : 'Expand tree'}
          onClick={e => { e.stopPropagation(); toggleTopicExpanded(topic.id); }}
        >
          {isExpanded ? <Minus size={12} /> : <Plus size={12} />}
        </button>

        {editing ? (
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none border-b border-blue-400 text-sm min-w-0"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') { setEditTitle(topic.title); setEditing(false); }
            }}
            onBlur={submitRename}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm truncate">{topic.title}</span>
        )}

        {editing ? (
          <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
            <button className="p-0.5 text-green-500 hover:text-green-600 rounded" onClick={submitRename}><Check size={13} /></button>
            <button className="p-0.5 text-gray-400 hover:text-gray-600 rounded" onClick={() => { setEditTitle(topic.title); setEditing(false); }}><X size={13} /></button>
          </div>
        ) : (
          <div className="flex gap-0.5 opacity-0 group-hover/topic:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded" title="Rename" onClick={() => { setEditTitle(topic.title); setEditing(true); }}>
              <Pencil size={12} />
            </button>
            <button className="p-0.5 text-gray-400 hover:text-red-500 rounded" title="Delete" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {isExpanded && <NodeTree topicId={topic.id} />}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${topic.title}"?`}
          message="This will permanently delete the topic and all its conversation nodes."
          onConfirm={async () => { setConfirmDelete(false); await deleteTopic(topic.id); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
