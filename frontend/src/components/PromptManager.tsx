'use client';

import { useState, useEffect } from 'react';
import { promptAPI, PromptConfig } from '../lib/api';
import toast from 'react-hot-toast';
import { MessageSquare, User, FileSearch, MessageCircle, Save, Loader2, Lightbulb } from 'lucide-react';

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
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded-xl w-1/3"></div>
          <div className="space-y-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="h-5 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-32 bg-gray-100 rounded-xl"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-50 rounded-2xl">
            <MessageSquare className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-medium text-gray-900">Prompt Management</h2>
            <p className="text-sm text-gray-500">Configure AI assistant behavior</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30 disabled:bg-gray-300 text-white rounded-xl font-medium transition-all duration-200"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {/* Form Cards */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center w-9 h-9 bg-blue-50 rounded-xl flex-shrink-0 mt-0.5">
              <MessageCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <label htmlFor="system_prompt" className="block text-base font-medium text-gray-900 mb-1">
                System Prompt
              </label>
              <p className="text-sm text-gray-500 mb-3">Defines the AI assistant's role and behavior</p>
              <textarea
                id="system_prompt"
                value={prompts.system_prompt}
                onChange={(e) => handleInputChange('system_prompt', e.target.value)}
                rows={8}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-vertical bg-gray-50 hover:bg-white text-gray-900 transition-colors text-sm"
                placeholder="Enter the system prompt..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center w-9 h-9 bg-green-50 rounded-xl flex-shrink-0 mt-0.5">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <label htmlFor="user_greeting" className="block text-base font-medium text-gray-900 mb-1">
                User Greeting
              </label>
              <p className="text-sm text-gray-500 mb-3">Message shown when users start a conversation</p>
              <textarea
                id="user_greeting"
                value={prompts.user_greeting}
                onChange={(e) => handleInputChange('user_greeting', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-vertical bg-gray-50 hover:bg-white text-gray-900 transition-colors text-sm"
                placeholder="Enter the greeting message..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center w-9 h-9 bg-amber-50 rounded-xl flex-shrink-0 mt-0.5">
              <FileSearch className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <label htmlFor="context_instruction" className="block text-base font-medium text-gray-900 mb-1">
                Context Instruction
              </label>
              <p className="text-sm text-gray-500 mb-3">Instructions for using context from documents</p>
              <textarea
                id="context_instruction"
                value={prompts.context_instruction}
                onChange={(e) => handleInputChange('context_instruction', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-vertical bg-gray-50 hover:bg-white text-gray-900 transition-colors text-sm"
                placeholder="Enter context instructions..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center w-9 h-9 bg-red-50 rounded-xl flex-shrink-0 mt-0.5">
              <MessageSquare className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <label htmlFor="fallback_response" className="block text-base font-medium text-gray-900 mb-1">
                Fallback Response
              </label>
              <p className="text-sm text-gray-500 mb-3">Response when AI cannot answer based on context</p>
              <textarea
                id="fallback_response"
                value={prompts.fallback_response}
                onChange={(e) => handleInputChange('fallback_response', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-vertical bg-gray-50 hover:bg-white text-gray-900 transition-colors text-sm"
                placeholder="Enter fallback response..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tips Card */}
      <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-blue-100 rounded-xl flex-shrink-0">
            <Lightbulb className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-3">Tips for Effective Prompts</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Be specific about the AI's role and expertise area</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Include important guidelines and limitations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Maintain a consistent tone and style</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Test your prompts thoroughly before deploying</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}