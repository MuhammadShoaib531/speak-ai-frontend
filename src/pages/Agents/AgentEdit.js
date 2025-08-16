import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { ArrowLeftIcon, SparklesIcon } from '@heroicons/react/24/outline';

import api from '../../api/axiosInstance';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { normalizeAgentForEdit } from '../../lib/commonUtils';

const AgentEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { fetchAgents, updateAgentExact } = useAppStore();

  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      companyName: '',
      firstMessage: '',
    },
  });

  const companyName = watch('companyName');
  const email = watch('email');
  const name = watch('name');
  
  useEffect(() => {
    let mounted = true;

    const loadAgent = async () => {
      setLoading(true);
      const loginEmail = user?.email || user?.user_email || '';

      try {
        const resOne = await api.get(`/auth/agent/get-agent/${id}`).catch((e) => ({ __err: e }));

        let agentData;

        if (!resOne.__err && resOne?.data) {
          agentData = normalizeAgentForEdit(resOne.data, loginEmail);
        } else {
          const resList = await api
            .get('/auth/admin/user-agents', { params: { email: loginEmail } })
            .catch((e) => ({ __err: e }));

          if (!resList.__err) {
            const list = Array.isArray(resList?.data?.agents) ? resList.data.agents : [];
            const foundFromList =
              list.find((a) => String(a.agent_id) === String(id)) ||
              list.find((a) => String(a.id) === String(id)) ||
              list.find((a) => String(a._id) === String(id));

            if (foundFromList) {
              agentData = normalizeAgentForEdit(foundFromList, resList?.data?.user_email || loginEmail);
            }
          }

          if (!agentData) {
            const resAll = await api
              .post('/analysis/training/agent-individual-analytics', {})
              .catch((e) => ({ __err: e }));

            if (!resAll.__err) {
              const list = Array.isArray(resAll?.data?.individual_results)
                ? resAll.data.individual_results
                : [];

              const foundAny =
                list.find((a) => String(a.agent_id) === String(id)) ||
                list.find((a) => String(a.id) === String(id)) ||
                list.find((a) => String(a._id) === String(id));

              if (foundAny) {
                agentData = normalizeAgentForEdit(foundAny, loginEmail);
              }
            }
          }

          if (!agentData) {
            throw new Error('Agent not found');
          }
        }

        if (!mounted) return;

        reset({
          name: agentData.name,
          phone: agentData.phone,
          email: agentData.email,
          companyName: agentData.companyName,
          firstMessage: agentData.firstMessage,
        });
      } catch (err) {
        if (!mounted) return;
        toast.error(err?.message || 'Failed to load agent');
        navigate('/agents', { replace: true });
        return;
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAgent();
    return () => {
      mounted = false;
    };
  }, [id, user]);

  const onSubmit = async (data) => {
    const res = await updateAgentExact({
      email: data.email,
      agent_name: data.name,
      first_message: data.firstMessage,
      business_name: data.companyName || undefined,
      contact_phone_number: data.phone || undefined,
    });

    if (res?.success) {
      toast.success('Agent updated successfully!');
      await fetchAgents?.();
      navigate('/agents');
    } else {
      toast.error(res?.error || 'Failed to update agent');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card animate-pulse h-40" />
        <div className="card animate-pulse h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Link to="/agents" className="mr-4 text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Agent</h1>
          <p className="mt-2 text-sm text-gray-600">Modify your AI agent configuration</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Agent Name</label>
              <input
                type="text"
                className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition bg-gray-50 border-purple-200 focus:border-purple-400 ring-purple-100"
                value={`${name || ''}`}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                className={`mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition ${errors.phone ? 'border-rose-300 ring-rose-100' : 'border-purple-200 focus:border-purple-400 ring-purple-100'}`}
                placeholder="+1 (555) 123-4567"
                {...register('phone')}
              />
              {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
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
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="text"
                className="mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition bg-gray-50 border-purple-200 focus:border-purple-400 ring-purple-100"
                value={`${email || ''}`}
                readOnly
              />
              <input type="hidden" {...register('email')} />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">First Message</h3>
          <label className="block text-sm font-medium text-gray-700">
            Greeting / First message to caller
          </label>
          <textarea
            rows={4}
            className={`mt-1 w-full pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition ${errors.firstMessage ? 'border-rose-300 ring-rose-100' : 'border-purple-200 focus:border-purple-400 ring-purple-100'}`}
            placeholder="Hello! I am your assistant. How may I help you?"
            {...register('firstMessage', { required: 'First message is required' })}
          />
          {errors.firstMessage && (
            <p className="mt-1 text-sm text-red-600">{errors.firstMessage.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 rounded-xl">
          <Link to="/agents" className="btn btn-secondary">
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-5 py-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-60"
          >
            <SparklesIcon className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving…' : 'Update Agent'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AgentEdit;
