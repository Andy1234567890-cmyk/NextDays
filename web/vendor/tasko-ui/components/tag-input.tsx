'use client';
import { Icon } from '@iconify/react';
import type React from 'react';
import { useState } from 'react';
import { Badge } from './badge';
import { Button } from './button';
import { Input } from './input';

interface TagInputProps {
  placeholder?: string;
  tags: string[];
  setTags: (tags: string[]) => void;
}

export function TagInput({ placeholder, tags, setTags }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag} // Add tag on blur
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" onClick={addTag} size="icon" variant="outline">
          <Icon icon="lucide:plus" className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <Badge
            key={tag}
            variant="secondary"
            className="border border-gray-200 bg-white px-2 py-1 font-normal text-gray-700 text-sm hover:bg-gray-50"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-2 hover:text-red-500 focus:outline-none"
            >
              <Icon icon="lucide:x" className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
