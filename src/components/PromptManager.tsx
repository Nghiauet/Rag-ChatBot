'use client';

import { useState, useEffect } from 'react';
import { promptAPI, PromptConfig } from '../lib/api';
import toast from 'react-hot-toast';
import { MessageSquare, User, FileSearch, MessageCircle, Save, Loader2, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';

type PromptField = keyof PromptConfig;

export default function PromptManager() {
  const [prompts, setPrompts] = useState<PromptConfig>({
    system_prompt: '',
    user_greeting: '',
    context_instruction: '',
    fallback_response: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<PromptField>>(new Set(['system_prompt']));

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

  const toggleSection = (field: PromptField) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(field)) {
        newSet.delete(field);
      } else {
        newSet.add(field);
      }
      return newSet;
    });
  };

  const getPreviewText = (text: string, maxLength: number = 100) => {
    if (!text) return 'No content yet...';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getCharCount = (text: string) => {
    return text.length;
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

  const promptSections = [
    {
      field: 'system_prompt' as PromptField,
      title: 'System Prompt',
      description: 'Defines the AI assistant\'s role and behavior',
      icon: MessageCircle,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      rows: 8
    },
    {
      field: 'user_greeting' as PromptField,
      title: 'User Greeting',
      description: 'Message shown when users start a conversation',
      icon: User,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      rows: 4
    },
    {
      field: 'context_instruction' as PromptField,
      title: 'Context Instruction',
      description: 'Instructions for using context from documents',
      icon: FileSearch,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      rows: 4
    },
    {
      field: 'fallback_response' as PromptField,
      title: 'Fallback Response',
      description: 'Response when AI cannot answer based on context',
      icon: MessageSquare,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
      rows: 4
    }
  ];

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

      {/* Accordion Sections */}
      <div className="space-y-3">
        {promptSections.map((section) => {
          const isExpanded = expandedSections.has(section.field);
          const Icon = section.icon;
          const content = prompts[section.field];
          const charCount = getCharCount(content);

          return (
            <div
              key={section.field}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200"
            >
              {/* Header - Always Visible */}
              <button
                onClick={() => toggleSection(section.field)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ${section.iconBg}`}>
                    <Icon className={`w-5 h-5 ${section.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-base font-medium text-gray-900">
                        {section.title}
                      </h3>
                      <span className="text-xs text-gray-500 font-medium">
                        {charCount} characters
                      </span>
                    </div>
                    {!isExpanded && (
                      <p className="text-sm text-gray-500 truncate">
                        {getPreviewText(content)}
                      </p>
                    )}
                    {isExpanded && (
                      <p className="text-sm text-gray-500">
                        {section.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                  <textarea
                    id={section.field}
                    value={content}
                    onChange={(e) => handleInputChange(section.field, e.target.value)}
                    rows={section.rows}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-vertical bg-gray-50 hover:bg-white text-gray-900 transition-colors text-sm leading-relaxed"
                    placeholder={`Enter ${section.title.toLowerCase()}...`}
                  />
                </div>
              )}
            </div>
          );
        })}
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