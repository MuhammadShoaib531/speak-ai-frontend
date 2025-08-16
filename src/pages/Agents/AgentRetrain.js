import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, MicrophoneIcon, SparklesIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

import api from '../../api/axiosInstance';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import languageList from '../../data/languages.json';
import { norm, toTitle } from '../../lib/commonUtils';

const cutMandatoryTail = (text = '') => {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf('important:');
  return idx >= 0 ? text.slice(0, idx).trim() : text;
};

const extractPrompt = (raw = {}) => {
  const candidates = [
    raw.prompt,
    raw.agent_prompt,
    raw.initial_prompt,
    raw.system_prompt,
    raw.description?.prompt,
    raw.config?.prompt,
    raw.prompts?.system,
    raw.prompts?.initial,
  ].filter(Boolean);

  for (const v of candidates) {
    const str = String(v ?? '').trim();
    if (str) return str;
  }

  for (const [k, v] of Object.entries(raw)) {
    if (/prompt/i.test(k) && typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};

const agentTypeIcons = {
  customer_support: '🎧',
  lead_generation: '🚀',
  appointment_scheduling: '📅',
};

const normalizeFromAnalytics = (raw = {}) => ({
  id: raw.agent_id ?? String(raw.id ?? raw._id ?? ''),
  name: raw.agent_name ?? raw.name ?? 'Untitled Agent',
  type: norm(raw.agent_type ?? raw.type ?? 'customer_support'),
  language: raw.language ?? '',
  model: raw.llm ?? '',
  speakingStyle: raw.speaking_style ?? 'professional',
  prompt: extractPrompt(raw) || '',
});

const CheckBadge = () => (
  <span className="absolute right-2 top-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary-600 text-white text-[10px] shadow-sm">
    ✓
  </span>
);

const AgentRetrain = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { updateAgentExact, agentsScope } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [agentName, setAgentName] = useState('');
  const [email, setEmail] = useState(''); 
  const [selectedType, setSelectedType] = useState('customer_support');
  const [language, setLanguage] = useState('English'); 
  const [model, setModel] = useState('');
  const [speakingStyle, setSpeakingStyle] = useState('professional');
  const [prompt, setPrompt] = useState('');

  const [voiceFile, setVoiceFile] = useState(null);
  const [knowledgeFile, setKnowledgeFile] = useState(null);

  const typeCards = useMemo(
    () => ['customer_support', 'lead_generation', 'appointment_scheduling'],
    []
  );

  useEffect(() => {
    let mounted = true;

    const findInList = (list = []) =>
      list.find((a) => String(a.agent_id) === String(id)) ||
      list.find((a) => String(a.id) === String(id)) ||
      list.find((a) => String(a._id) === String(id));

    const loadFromAllAgents = async () => {
      const res = await api.post('/analysis/training/agent-individual-analytics', {});
      const list = Array.isArray(res?.data?.individual_results) ? res.data.individual_results : [];
      return findInList(list);
    };

    const tryLoadFromUserAgents = async (ownerEmail) => {
      if (!ownerEmail) return null;
      try {
        const res = await api.get('/auth/admin/user-agents', { params: { email: ownerEmail } });
        const list = Array.isArray(res?.data?.agents) ? res.data.agents : [];
        return findInList(list) || null;
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) return null;
        return null;
      }
    };

    const load = async () => {
      setLoading(true);
      const authedEmail = user?.email || user?.user_email || '';
      const scopedEmail = agentsScope?.type === 'user' && agentsScope?.email ? agentsScope.email : authedEmail;

      setEmail(scopedEmail);

      try {
        let base = await loadFromAllAgents();
        if (!base) base = await tryLoadFromUserAgents(scopedEmail);

        if (!base) {
          toast.error('Agent not found');
          navigate('/training', { replace: true });
          return;
        }

        const a = normalizeFromAnalytics(base);
        if (!mounted) return;

        setAgentName(a.name);
        setSelectedType(a.type || 'customer_support');
        setLanguage(a.language || 'English'); 
        setModel(a.model || '');
        setSpeakingStyle(a.speakingStyle || 'professional');

        const basePrompt = cutMandatoryTail(a.prompt || '');
        setPrompt(basePrompt);

        if (!a.prompt || !a.model) {
          const richer = await tryLoadFromUserAgents(scopedEmail);
          if (mounted && richer) {
            const enrichedPrompt = extractPrompt(richer);
            if (enrichedPrompt && !a.prompt) {
              setPrompt(cutMandatoryTail(enrichedPrompt));
            }

            if (!a.model && richer.llm) {
              setModel(richer.llm);
            }
          }
        }

      } catch {
        toast.error('Failed to load agent');
        navigate('/training', { replace: true });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [id, user, agentsScope, navigate]);

  const handleVoiceFileChange = (e) => {
    const file = (e.target.files || [])[0];
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

  const handleKnowledgeFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 1) toast.info('Only one document is allowed. Using the first one.');
    const file = files[0] || null;
    if (!file) return;
    const lower = (file.name || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();
    const okExt = /\.(pdf|doc|docx)$/i.test(lower);
    const okMime = mime.includes('pdf') || mime.includes('msword') || mime.includes('officedocument');
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

  const handleRetrain = async () => {
    const trimmedPrompt = cutMandatoryTail(prompt);

    try {
      setSubmitting(true);

      const { success, error } = await updateAgentExact({
        email,
        agent_name: agentName,
        prompt: trimmedPrompt || undefined,
        llm: model || undefined,
        file: knowledgeFile || undefined,
        voice_file: voiceFile || undefined,
        agent_type: selectedType || undefined,
        speaking_style: speakingStyle || undefined,
      });

      if (!success) {
        toast.error(error || 'Failed to retrain agent');
        return;
      }

      toast.success('Agent retrain submitted!');
      navigate('/training');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to retrain agent';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse card h-40" />
        <div className="animate-pulse card h-72" />
        <div className="animate-pulse card h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Link to="/training" className="mr-4 text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retrain Agent</h1>
          <p className="mt-2 text-sm text-gray-600">Adjust role, behavior, voice and knowledge base.</p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Agent Type</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {['customer_support', 'lead_generation', 'appointment_scheduling'].map((type) => {
            const active = selectedType === type;
            return (
              <div
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
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Settings</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Agent Name</label>
            <input type="text" value={agentName} disabled className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition bg-gray-100 border-purple-200 focus:border-purple-400 ring-purple-100 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={email} disabled className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition bg-gray-100 border-purple-200 focus:border-purple-400 ring-purple-100 cursor-not-allowed" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Default Language</label>
            <select className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="">Select a language</option>
              {(languageList?.languages || []).map((l) => (
                <option key={l.name} value={l.name}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">AI Model</label>
            <select className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">Select a model</option>
              {(languageList?.models || []).map((m, idx) => (
                <option key={idx} value={m}>{m}</option>
              ))}
            </select>
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
                <input type="file" accept=".mp3" onChange={handleVoiceFileChange} className="sr-only" />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">MP3 only — at least 60 seconds</p>
          </div>
        </div>

        {voiceFile && (
          <div className="mt-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">File to upload</h4>
            <div className="flex items-center justify-between p-2 border border-gray-200 rounded-md">
              <span className="text-sm text-gray-600 truncate">{voiceFile.name}</span>
              <button type="button" onClick={clearVoiceFile} className="text-red-600 hover:text-red-700">
                Remove
              </button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700">Speaking Style</label>
          <select className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100" value={speakingStyle} onChange={(e) => setSpeakingStyle(e.target.value)}>
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
                  onChange={handleKnowledgeFileChange}
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
        <h3 className="text-lg font-medium text-gray-900">Prompt Message</h3>
        <p className="mt-1 text-sm text-gray-500">
          Describe how your agent should behave and respond.
        </p>

        <label className="block text-sm font-medium text-gray-700 mt-4">Initial Prompt</label>
        <textarea
          rows={5}
          className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
          placeholder="e.g., Respond politely and help users with booking appointments."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      <div className="flex justify-end space-x-3 rounded-xl">
        <Link to="/training" className="btn btn-secondary">Cancel</Link>
        <button
          type="button"
          onClick={handleRetrain}
          disabled={submitting}
          className="inline-flex items-center px-5 py-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-60"
        >
          <SparklesIcon className="h-4 w-4 mr-2" />
          {submitting ? 'Saving…' : 'Retrain Agent'}
        </button>
      </div>
    </div>
  );
};

export default AgentRetrain;
