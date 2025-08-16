import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Link, useNavigate } from 'react-router-dom';
import {
  DocumentArrowUpIcon,
  SparklesIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

import useAppStore from '../../store/appStore';
import useAuthStore from '../../store/authStore';
import api from '../../api/axiosInstance';
import { pad } from '../../lib/commonUtils';

const todayDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowHHMM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const BatchCallForm = () => {
  const navigate = useNavigate();

  const { user: currentUser } = useAuthStore();
  const currentEmail = (currentUser?.email || currentUser?.user_email || '').trim();
  const currentEmailLc = currentEmail.toLowerCase();

  const { createBatchCallingJob, batchCalling } = useAppStore((s) => ({
    createBatchCallingJob: s.createBatchCallingJob,
    batchCalling: s.batchCalling,
  }));

  const [uaLoading, setUaLoading] = useState(true);
  const [uaError, setUaError] = useState('');
  const [uaAgentsRaw, setUaAgentsRaw] = useState([]);

  const fetchUserAgents = useCallback(async () => {
    if (!currentEmail) {
      setUaAgentsRaw([]);
      setUaLoading(false);
      return;
    }
    setUaLoading(true);
    setUaError('');
    try {
      const res = await api.get('/auth/admin/user-agents', { params: { email: currentEmail } });
      const rows = Array.isArray(res?.data?.agents) ? res.data.agents : [];
      const filtered = rows.filter(a =>
        String(a?.user_email || '').trim().toLowerCase() === currentEmailLc
      );
      filtered.sort((a, b) => {
        const ta = new Date(a?.updated_at || a?.created_at || 0).getTime();
        const tb = new Date(b?.updated_at || b?.created_at || 0).getTime();
        return tb - ta;
      });
      setUaAgentsRaw(filtered);
    } catch (e) {
      setUaError(e?.response?.data?.message || e?.message || 'Failed to load agents');
      setUaAgentsRaw([]);
    } finally {
      setUaLoading(false);
    }
  }, [currentEmail, currentEmailLc]);

  useEffect(() => {
    fetchUserAgents();
  }, [fetchUserAgents]);

  const normalizedAgents = useMemo(() => {
    const list = Array.isArray(uaAgentsRaw) ? uaAgentsRaw : [];
    return list.map((a, i) => {
      const name = a?.agent_name || a?.name || a?.business_name || `Agent ${i + 1}`;
      const id = a?.agent_id || a?.id || String(i);
      return { id, name };
    });
  }, [uaAgentsRaw]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      phone_column: '',
      scheduled_time_time: nowHHMM(),
      agent_name: '',
      call_name: '',
    },
  });

  useEffect(() => {
    if (!uaLoading && normalizedAgents.length === 1) {
      setValue('agent_name', normalizedAgents[0].name);
    }
  }, [uaLoading, normalizedAgents, setValue]);

  const [csvFile, setCsvFile] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const nameOk = /\.csv$/i.test(file.name);
    const typeOk = (file.type || '').toLowerCase() === 'text/csv' || nameOk;

    if (!nameOk || !typeOk) {
      toast.error('Please upload a valid CSV (.csv) file');
      return;
    }
    setCsvFile(file);
  };

  const buildScheduledTime = (hhmm) => `${todayDate()} ${hhmm}`;

  const onSubmit = async (data) => {
    if (!csvFile) {
      toast.error('Please upload a CSV file');
      return;
    }
    const timeVal = (data.scheduled_time_time || '').trim();
    if (!/^\d{2}:\d{2}$/.test(timeVal)) {
      toast.error('Please choose a valid time');
      return;
    }

    const payload = {
      agent_name: data.agent_name,             
      call_name: data.call_name,
      phone_column: data.phone_column,
      scheduled_time: buildScheduledTime(timeVal),
      csvOrExcelFile: csvFile,
    };

    const res = await createBatchCallingJob(payload);
    if (res?.success) {
      toast.success('Batch calling job submitted successfully!');
      navigate('/batchcallinglist');
    } else {
      toast.error(res?.error || 'Batch call submission failed');
    }
  };

  const loading = !!batchCalling?.creating;
  const agentsLoading = uaLoading; 

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Link to="/batchcallinglist" className="mr-4 text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Batch Call</h1>
          <p className="mt-2 text-sm text-gray-600">
            Schedule and configure your batch calling job
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Batch Call Information</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Agent Name</label>
              <select
                disabled={agentsLoading}
                {...register('agent_name', { required: 'Agent name is required' })}
                className={`mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition ${
                  errors.agent_name ? 'border-rose-300 ring-rose-100' : 'border-purple-200 focus:border-purple-400 ring-purple-100'
                }`}
              >
                <option value="">
                  {agentsLoading ? 'Loading agents...' : 'Select an agent'}
                </option>
                {normalizedAgents.map((agent) => (
                  <option key={agent.id} value={agent.name}>
                    {agent.name}
                  </option>
                ))}
              </select>
              {uaError && <p className="mt-1 text-sm text-red-600">{uaError}</p>}
              {errors.agent_name && (
                <p className="mt-1 text-sm text-red-600">{errors.agent_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Call Name</label>
              <input
                type="text"
                className={`mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition ${
                  errors.call_name ? 'border-rose-300 ring-rose-100' : 'border-purple-200 focus:border-purple-400 ring-purple-100'
                }`}
                placeholder="e.g. Reminder Campaign"
                {...register('call_name', { required: 'Call name is required' })}
              />
              {errors.call_name && (
                <p className="mt-1 text-sm text-red-600">{errors.call_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Column</label>
              <input
                type="text"
                className={`mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition ${
                  errors.phone_column ? 'border-rose-300 ring-rose-100' : 'border-purple-200 focus:border-purple-400 ring-purple-100'
                }`}
                placeholder="e.g. phone"
                {...register('phone_column')}
              />
              {errors.phone_column && (
                <p className="mt-1 text-sm text-red-600">{errors.phone_column.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Time (Today)</label>
              <input
                type="time"
                step="60"
                className={`mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition ${
                  errors.scheduled_time_time ? 'border-rose-300 ring-rose-100' : 'border-purple-200 focus:border-purple-400 ring-purple-100'
                }`}
                {...register('scheduled_time_time', { required: 'Time is required' })}
              />
              {errors.scheduled_time_time && (
                <p className="mt-1 text-sm text-red-600">{errors.scheduled_time_time.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Upload CSV</h3>

          <div className="flex justify-center rounded-md border-2 border-dashed border-gray-300 px-6 pt-5 pb-6">
            <div className="space-y-1 text-center">
              <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600 justify-center">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                  <span>Upload CSV</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">Only .csv files up to ~5MB</p>
            </div>
          </div>

          {csvFile && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">File to upload</label>
              <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <span className="text-sm text-gray-800 truncate">{csvFile.name}</span>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => setCsvFile(null)}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 rounded-xl">
          <Link to="/batchcallinglist" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!!batchCalling?.creating || !isValid || !csvFile || uaLoading || normalizedAgents.length === 0}
            className="inline-flex items-center px-5 py-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50"
          >
            {batchCalling?.creating ? (
              <>
                <div className="spinner mr-2"></div> Creating...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4 mr-2" />
                Create Batch Call
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BatchCallForm;