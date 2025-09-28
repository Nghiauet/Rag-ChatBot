'use client';

import { useState, useEffect } from 'react';
import { promptAPI, PromptConfig } from '../lib/api';
import toast from 'react-hot-toast';

export default function PromptManager() {
  const [prompts, setPrompts] = useState<PromptConfig>({
    system_prompt: '',
    user_greeting: '',
    context_instruction: '',
    fallback_response: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const data = await promptAPI.getPrompts();
      setPrompts(data);
    } catch (error) {
      console.error('Error loading prompts:', error);
      toast.error('Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await promptAPI.updatePrompts(prompts);
      toast.success('Prompts updated successfully!');
    } catch (error) {
      console.error('Error saving prompts:', error);
      toast.error('Failed to save prompts');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof PromptConfig, value: string) => {
    setPrompts(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i}>
                <div className="h-4 bg-gray-200 rounded w-1/6 mb-2"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Prompt Management</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700 mb-2">
            System Prompt
          </label>
          <textarea
            id="system_prompt"
            value={prompts.system_prompt}
            onChange={(e) => handleInputChange('system_prompt', e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical bg-white text-gray-900"
            placeholder="Enter the system prompt that defines the AI assistant's role and behavior..."
          />
        </div>

        <div>
          <label htmlFor="user_greeting" className="block text-sm font-medium text-gray-700 mb-2">
            User Greeting
          </label>
          <textarea
            id="user_greeting"
            value={prompts.user_greeting}
            onChange={(e) => handleInputChange('user_greeting', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical bg-white text-gray-900"
            placeholder="Enter the greeting message shown to users when they start a conversation..."
          />
        </div>

        <div>
          <label htmlFor="context_instruction" className="block text-sm font-medium text-gray-700 mb-2">
            Context Instruction
          </label>
          <textarea
            id="context_instruction"
            value={prompts.context_instruction}
            onChange={(e) => handleInputChange('context_instruction', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical bg-white text-gray-900"
            placeholder="Enter instructions for how the AI should use context from documents..."
          />
        </div>

        <div>
          <label htmlFor="fallback_response" className="block text-sm font-medium text-gray-700 mb-2">
            Fallback Response
          </label>
          <textarea
            id="fallback_response"
            value={prompts.fallback_response}
            onChange={(e) => handleInputChange('fallback_response', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical bg-white text-gray-900"
            placeholder="Enter the response when the AI cannot answer based on available context..."
          />
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Tips for Writing Effective Prompts</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Be specific about the AI's role and expertise area</li>
          <li>• Include important guidelines and limitations</li>
          <li>• Maintain a consistent tone and style</li>
          <li>• Test your prompts thoroughly before deploying</li>
        </ul>
      </div>
    </div>
  );
}