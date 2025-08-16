import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
  ArrowLeftIcon,
  DocumentArrowUpIcon,
  MicrophoneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import languageList from '../../data/languages.json';

const toTitle = (s) =>
  s ? s.toString().replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '';

const agentTypeIcons = {
  customer_support: '🎧',
  lead_generation: '🚀',
  appointment_scheduling: '📅',
};

const CheckBadge = () => (
  <span className="absolute right-2 top-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary-600 text-white text-[10px] shadow-sm">
    ✓
  </span>
);

const AgentCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createAgent } = useAppStore();

  const [selectedType, setSelectedType] = useState('customer_support');
  const [languages, setLanguages] = useState([]);
  const [models, setModels] = useState([]);

  const [voiceFile, setVoiceFile] = useState(null);
  const [knowledgeFile, setKnowledgeFile] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      firstMessage: 'Hello! I am your assistant. How may I help you?',
      prompt: '',
      email: user?.email || user?.user_email || '',
      model: '',
      companyName: '',
      phone: '',
      language: '',
      speakingStyle: 'professional',
    },
  });

  useEffect(() => {
    try {
      const sortedLanguages = (languageList?.languages || []).map((l) => l.name).sort();
      const modelList = languageList?.models || [];
      setLanguages(sortedLanguages);
      setModels(modelList);
    } catch {
      setLanguages(['English', 'French', 'Spanish', 'German', 'Arabic']);
      setModels(['ChatGPT 3.5', 'ChatGPT 4.0', 'ClaudeAI', 'Gemini']);
    }
  }, []);

  useEffect(() => {
    setValue('email', user?.email || user?.user_email || '');
  }, [user, setValue]);

  const typeCards = useMemo(
    () => ['customer_support', 'lead_generation', 'appointment_scheduling'],
    []
  );

  const handleVoiceChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 1) toast.info('Only one voice file is allowed. Using the first one.');
    const file = files[0];
    if (!file) return;

    const isMp3ByExt = /\.mp3$/i.test(file.name);
    const isMp3ByMime = (file.type || '').toLowerCase() === 'audio/mpeg';
    if (!isMp3ByExt && !isMp3ByMime) {
      toast.error('Only MP3 files are allowed for voice.');
      e.target.value = '';
      setVoiceFile(null);
      return;
    }
    setVoiceFile(file);
  };

  const handleKnowledgeChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 1) toast.info('Only one document is allowed. Using the first one.');
    const file = files[0];
    if (!file) return;

    const okExt = /\.(pdf|doc|docx)$/i.test(file.name);
    const mime = (file.type || '').toLowerCase();
    const okMime =
      mime === 'application/pdf' ||
      mime === 'application/msword' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!okExt && !okMime) {
      toast.error('Only PDF or DOC/DOCX files are allowed.');
      e.target.value = '';
      setKnowledgeFile(null);
      return;
    }

    setKnowledgeFile(file);
  };

  const clearKnowledgeFile = () => setKnowledgeFile(null);
  const clearVoiceFile = () => setVoiceFile(null);

  const onSubmit = async (data) => {
    if (!selectedType) {
      toast.error('Please select an agent type.');
      return;
    }

    const payload = {
      name: data.name,                   
      firstMessage: data.firstMessage,    
      prompt: data.prompt,  
      email: data.email,     
      model: data.model,   
      type: selectedType,
      speakingStyle: data.speakingStyle || undefined,
      businessName: data.companyName || undefined,
      phone: data.phone || undefined,
      language: data.language || undefined,
      knowledgeFiles: knowledgeFile ? [knowledgeFile] : [],
      voiceFile: voiceFile || null,
    };

    const res = await createAgent(payload);
    if (res?.success) {
      toast.success('Agent created successfully!');
      navigate('/agents');
    } else {
      toast.error(res?.error || 'Failed to create agent');
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center">
        <Link to="/agents" className="mr-4 text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Agent</h1>
          <p className="mt-2 text-sm text-gray-600">
            Set up your AI agent with custom voice and knowledge base
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Select Agent Type</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {typeCards.map((type) => {
              const active = selectedType === type;
              return (
                <button
                  type="button"
                  key={type}
                  className={`relative rounded-lg border-2 cursor-pointer transition-colors ${
                    active ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => setSelectedType(type)}
                >
                  {active && <CheckBadge />}
                  <div className="p-4">
                    <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 text-2xl bg-white rounded-lg">
                      {agentTypeIcons[type]}
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 text-center capitalize">
                      {toTitle(type)}
                    </h4>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Agent Name</label>
              <input
                type="text"
                placeholder="Enter Agent Name"
                className={`mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition ${
                  errors.name ? 'border-rose-300 ring-rose-100' : 'border-purple-200 focus:border-purple-400 ring-purple-100'
                }`}
                {...register('name', { required: 'Agent name is required' })}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Company Name</label>
              <input
                type="text"
                className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
                placeholder="e.g., Apple"
                {...register('companyName')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
                placeholder="+1 (555) 123-4567"
                {...register('phone')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition bg-gray-50 border-purple-200 focus:border-purple-400 ring-purple-100"
                {...register('email', { required: 'Email is required' })}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Default Language</label>
              <select
                className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition w-full border-purple-200 focus:border-purple-400 ring-purple-100"
                {...register('language')}
              >
                <option value="">Select a language</option>
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">AI Model</label>
              <select
                className={`mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition w-full ${
                  errors.model ? 'border-rose-300 ring-rose-100' : 'border-purple-200 focus:border-purple-400 ring-purple-100'
                }`}
                {...register('model', { required: 'Model (LLM) is required' })}
              >
                <option value="">Select a model</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {errors.model && <p className="mt-1 text-sm text-red-600">{errors.model.message}</p>}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Voice Configuration</h3>
          <label className="block text-sm font-medium text-gray-700">
            Upload a voice file <span className="text-gray-500 font-normal">or drag and drop</span>
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <MicrophoneIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                  <span>Upload a voice file</span>
                  <input
                    type="file"
                    accept=".mp3"
                    onChange={handleVoiceChange}
                    className="sr-only"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">MP3 only — at least 60 seconds</p>
            </div>
          </div>

          {voiceFile && (
            <div className="mt-3 flex items-center justify-between p-2 border border-gray-200 rounded-md">
              <span className="text-sm text-gray-600 truncate">{voiceFile.name}</span>
              <button type="button" onClick={clearVoiceFile} className="text-red-600 hover:text-red-700">
                Remove
              </button>
            </div>
          )}

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700">Speaking Style</label>
            <select
              className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
              {...register('speakingStyle')}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="casual">Casual</option>
              <option value="energetic">Energetic</option>
            </select>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Knowledge Base</h3>
          <label className="block text-sm font-medium text-gray-700">Upload Document</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                  <span>Upload document</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleKnowledgeChange}
                    className="sr-only"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">DOCX or PDF only</p>
            </div>
          </div>

          {knowledgeFile && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">File to upload</h4>
              <div className="flex items-center justify-between p-2 border border-gray-200 rounded-md">
                <span className="text-sm text-gray-600 truncate">{knowledgeFile.name}</span>
                <button
                  type="button"
                  onClick={clearKnowledgeFile}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900">First Message</h3>
          <p className="mt-1 text-sm text-gray-500">
            This is the first thing your agent says when a call begins.
          </p>
          <div className="mt-4">
            <textarea
              rows={3}
              className={`mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition ${
                errors.firstMessage ? 'border-rose-300 ring-rose-100' : 'border-purple-200 focus:border-purple-400 ring-purple-100'
              }`}
              placeholder="Hello! I am your assistant. How may I help you?"
              {...register('firstMessage', { required: 'First message is required' })}
            />
            {errors.firstMessage && (
              <p className="mt-1 text-sm text-red-600">{errors.firstMessage.message}</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900">Prompt Message</h3>
          <p className="mt-1 text-sm text-gray-500">
            Describe how your agent should behave and respond.
          </p>
          <div className="mt-4">
            <textarea
              rows={5}
              className={`mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition ${
                errors.prompt ? 'border-rose-300 ring-rose-100' : 'border-purple-200 focus:border-purple-400 ring-purple-100'
              }`}
              placeholder="e.g., Respond politely and help users with booking appointments."
              {...register('prompt', { required: 'Prompt is required' })}
            />
            {errors.prompt && <p className="mt-1 text-sm text-red-600">{errors.prompt.message}</p>}
          </div>
        </div>

        <div className="flex justify-end space-x-3 rounded-xl">
          <Link to="/agents" className="btn btn-secondary">Cancel</Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-5 py-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-60"
          >
            <SparklesIcon className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving…' : 'Create Agent'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AgentCreate;