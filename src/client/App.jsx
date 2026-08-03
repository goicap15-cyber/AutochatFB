import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppSidebar from './components/AppSidebar.jsx';
import ConversationSidebar from './components/ConversationSidebar.jsx';
import ChatHeader from './components/ChatHeader.jsx';
import MessageList from './components/MessageList.jsx';
import MessageComposer from './components/MessageComposer.jsx';
import LeadDetailsPanel from './components/LeadDetailsPanel.jsx';
import EmptyState from './components/EmptyState.jsx';
import SearchOverlay from './components/SearchOverlay.jsx';
import AccountManagerModal from './components/AccountManagerModal.jsx';
import AutoReplyModal from './components/AutoReplyModal.jsx';
import BroadcastModal from './components/BroadcastModal.jsx';
import AiConfigModal from './components/AiConfigModal.jsx';
import { useSocket } from './hooks/useSocket.js';
import { MessageSquare } from 'lucide-react';

const SESSION_USER = { id: 1, role: 'ADMIN', username: 'admin' };
const THEME_VERSION = 'chat-redesign-v1';

export default function App() {
  const { socket, isConnected } = useSocket();
  const [theme, setTheme] = useState(() => {
    if (localStorage.getItem('app_theme_version') !== THEME_VERSION) return 'light';
    return localStorage.getItem('app_theme') || 'light';
  });
  const [leadPanelCollapsed, setLeadPanelCollapsed] = useState(false);
  const [showLeadDrawer, setShowLeadDrawer] = useState(false);

  // Responsive detection
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' && window.innerWidth < 1200);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 900);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 1200);
      setIsMobile(window.innerWidth < 900);
      if (window.innerWidth >= 1200) setShowLeadDrawer(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard handler for Escape key on drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showLeadDrawer) {
        setShowLeadDrawer(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLeadDrawer]);

  useEffect(() => {
    localStorage.setItem('app_theme_version', THEME_VERSION);
    localStorage.setItem('app_theme', theme);
    document.documentElement.classList.toggle('light-theme', theme === 'light');
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  const [activeView, setActiveView] = useState('chat');
  const [threads, setThreads] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState({});
  const [contacts, setContacts] = useState({});
  const [hasCheckpoint, setHasCheckpoint] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data);
      setHasCheckpoint(data.some(a => a.status === 'CHECKPOINT'));
    } catch (e) {
      console.warn('Failed to load accounts:', e);
    }
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch(`/api/threads?user_id=${SESSION_USER.id}&role=${SESSION_USER.role}&tab=${activeTab}`);
      const data = await res.json();
      setThreads(data);
    } catch {
      setThreads([
        { id: 't_1001', contact_name: 'Nguyễn Văn A', last_message: 'Dạ anh tư vấn giúp em báo giá phần mềm!', is_unread: true, status: 'UNPROCESSED' },
        { id: 't_1002', contact_name: 'Trần Thị B', last_message: 'SĐT mình là 0912345678 nha anh', is_unread: false, status: 'ASSIGNED' }
      ]);
    }
  }, [activeTab]);

  const loadThreadsRef = useRef(loadThreads);
  useEffect(() => { loadThreadsRef.current = loadThreads; }, [loadThreads]);
  useEffect(() => { loadThreads(); loadAccounts(); }, [loadThreads, loadAccounts]);

  useEffect(() => {
    if (!isMobile && !activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [isMobile, activeThreadId, threads]);

  const requestedSyncRef = useRef(new Map());
  const threadsRef = useRef(threads);
  useEffect(() => { threadsRef.current = threads; }, [threads]);

  useEffect(() => {
    if (!activeThreadId) return;
    const threadIdStr = String(activeThreadId);
    if (!messages[threadIdStr]) {
      fetch(`/api/threads/${threadIdStr}/messages`)
        .then(r => r.json())
        .then(data => setMessages(prev => ({ ...prev, [threadIdStr]: data })))
        .catch(() => {});
    }

    // Gửi yêu cầu sync lịch sử mới nhất từ Facebook Extension cho thread này (chỉ gửi 1 lần mỗi 60 giây)
    if (socket) {
      const lastSync = requestedSyncRef.current.get(threadIdStr) || 0;
      if (Date.now() - lastSync > 60000) {
        requestedSyncRef.current.set(threadIdStr, Date.now());
        const activeThreadObj = threadsRef.current.find(t => String(t.id) === threadIdStr);
        socket.emit('REQUEST_SYNC_THREAD_MESSAGES', {
          account_id: activeThreadObj?.account_id || null,
          thread_id: threadIdStr,
          thread_url: activeThreadObj?.thread_url || null
        });
      }
    }
  }, [activeThreadId, socket]);

  useEffect(() => {
    if (!activeThreadId) return;
    const threadIdStr = String(activeThreadId);
    fetch(`/api/contacts/${threadIdStr}`)
      .then(r => r.json())
      .then(data => setContacts(prev => ({ ...prev, [threadIdStr]: { thread_id: threadIdStr, ...data } })))
      .catch(() => {});
  }, [activeThreadId]);

  useEffect(() => {
    if (!socket) return;
    socket.on('NEW_MESSAGE', (newMsg) => {
      const tidStr = String(newMsg.thread_id);
      setMessages(prev => {
        const currentMsgs = prev[tidStr] || [];
        let updated;
        if (newMsg.client_message_id) {
          const existsIdx = currentMsgs.findIndex(m => m.client_message_id === newMsg.client_message_id);
          if (existsIdx >= 0) {
            updated = [...currentMsgs];
            updated[existsIdx] = { ...newMsg, status: 'sent' };
          } else {
            updated = [...currentMsgs, { ...newMsg, status: 'sent' }];
          }
        } else {
          updated = [...currentMsgs, { ...newMsg, status: 'sent' }];
        }
        
        updated.sort((a, b) => {
          const tA = Number(a.timestamp_ms) || new Date(a.created_at || 0).getTime();
          const tB = Number(b.timestamp_ms) || new Date(b.created_at || 0).getTime();
          if (tA !== tB) return tA - tB;
          return (a.id || 0) - (b.id || 0);
        });

        return { ...prev, [tidStr]: updated };
      });

      setThreads(prev => {
        const idx = prev.findIndex(t => String(t.id) === tidStr);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], last_message: newMsg.content, is_unread: true };
          return updated;
        }
        return prev;
      });
      loadThreadsRef.current();
    });

    socket.on('MESSAGE_SENT', ({ thread_id, client_message_id }) => {
      const tidStr = String(thread_id);
      setMessages(prev => {
        const currentMsgs = prev[tidStr] || [];
        return {
          ...prev,
          [tidStr]: currentMsgs.map(m => m.client_message_id === client_message_id ? { ...m, status: 'sent' } : m)
        };
      });
    });

    socket.on('MESSAGE_SEND_FAILED', ({ thread_id, client_message_id, error }) => {
      const tidStr = String(thread_id);
      setMessages(prev => {
        const currentMsgs = prev[tidStr] || [];
        return {
          ...prev,
          [tidStr]: currentMsgs.map(m => m.client_message_id === client_message_id ? { ...m, status: 'failed', error } : m)
        };
      });
    });

    socket.on('THREAD_MESSAGES_UPDATED', ({ thread_id, messages: syncedMsgs }) => {
      const tidStr = String(thread_id);
      setMessages(prev => {
        const existing = prev[tidStr] || [];
        const mergedMap = new Map();

        // Nạp tin nhắn vừa sync
        (syncedMsgs || []).forEach(m => {
          const key = m.fb_message_id || m.client_message_id || `id_${m.id}`;
          mergedMap.set(key, { ...m, status: 'sent' });
        });

        // Giữ lại các tin nhắn pending/failed/realtime chưa có trong bản sync
        existing.forEach(m => {
          const key = m.fb_message_id || m.client_message_id || `id_${m.id}`;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, m);
          } else if (m.status === 'sending' || m.status === 'failed') {
            mergedMap.set(key, { ...mergedMap.get(key), status: m.status, error: m.error });
          }
        });

        const mergedArray = Array.from(mergedMap.values());
        mergedArray.sort((a, b) => {
          const tA = Number(a.timestamp_ms) || new Date(a.created_at || 0).getTime();
          const tB = Number(b.timestamp_ms) || new Date(b.created_at || 0).getTime();
          if (tA !== tB) return tA - tB;
          return (a.id || 0) - (b.id || 0);
        });

        return {
          ...prev,
          [tidStr]: mergedArray
        };
      });
    });

    socket.on('EXTENSION_CONNECTION_CHANGED', ({ account_id, is_connected }) => {
      setAccounts(prev => prev.map(a => String(a.id) === String(account_id) ? { ...a, is_extension_connected: is_connected } : a));
    });

    socket.on('CONTACT_UPDATED', ({ thread_id, avatar_url, name, phone, email }) => {
      const tidStr = String(thread_id);
      setThreads(prev => prev.map(t => String(t.id) === tidStr ? { ...t, ...(avatar_url ? { avatar_url } : {}), ...(name ? { contact_name: name } : {}) } : t));
      setContacts(prev => ({
        ...prev,
        [tidStr]: { ...prev[tidStr], thread_id: tidStr, ...(avatar_url ? { avatar_url } : {}), ...(name ? { name } : {}), ...(phone ? { phone } : {}), ...(email ? { email } : {}) }
      }));
    });

    socket.on('MESSAGE_UNSENT', ({ fb_message_id }) => {
      setMessages(prev => {
        const updated = {};
        Object.entries(prev).forEach(([tid, msgs]) => {
          updated[tid] = msgs.map(m => m.fb_message_id === fb_message_id ? { ...m, is_unsent: true } : m);
        });
        return updated;
      });
    });

    socket.on('ACCOUNT_STATUS_CHANGED', ({ status }) => {
      if (status === 'CHECKPOINT') setHasCheckpoint(true);
      loadAccounts();
    });

    socket.on('AI_PAUSED', ({ thread_id, until }) => {
      const tidStr = String(thread_id);
      setThreads(prev => prev.map(t => String(t.id) === tidStr ? { ...t, ai_paused_until: until } : t));
    });
    socket.on('THREAD_ASSIGNED', () => loadThreadsRef.current());
    socket.on('THREAD_COMPLETED', () => loadThreadsRef.current());
    socket.on('THREADS_SYNCED', ({ account_id, threads: syncedThreads }) => {
      if (!syncedThreads || !Array.isArray(syncedThreads)) return;
      setThreads(prev => {
        const accIdStr = String(account_id || '');
        const updatedThreads = [...prev];

        for (const synced of syncedThreads) {
          const syncedIdStr = String(synced.id);
          const syncedAccStr = String(synced.account_id || account_id || '');

          const idx = updatedThreads.findIndex(t => 
            String(t.id) === syncedIdStr && String(t.account_id || accIdStr) === syncedAccStr
          );

          if (idx >= 0) {
            updatedThreads[idx] = {
              ...updatedThreads[idx],
              ...synced,
              contact_name: synced.contact_name || synced.name || updatedThreads[idx].contact_name,
              avatar_url: synced.avatar_url || updatedThreads[idx].avatar_url,
              phone: synced.phone || updatedThreads[idx].phone,
              email: synced.email || updatedThreads[idx].email
            };
          } else {
            updatedThreads.push({
              ...synced,
              account_id: syncedAccStr || accIdStr
            });
          }
        }

        return updatedThreads.sort((a, b) => {
          const timeA = new Date(a.last_activity || a.updated_at || a.created_at || 0).getTime();
          const timeB = new Date(b.last_activity || b.updated_at || b.created_at || 0).getTime();
          return timeB - timeA;
        });
      });
    });

    return () => {
      socket.off('NEW_MESSAGE');
      socket.off('MESSAGE_SENT');
      socket.off('MESSAGE_SEND_FAILED');
      socket.off('EXTENSION_CONNECTION_CHANGED');
      socket.off('MESSAGE_UNSENT');
      socket.off('ACCOUNT_STATUS_CHANGED');
      socket.off('AI_PAUSED');
      socket.off('THREAD_ASSIGNED');
      socket.off('THREAD_COMPLETED');
      socket.off('THREADS_SYNCED');
    };
  }, [socket, loadAccounts]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setActiveModal('search'); }
      if (e.key === 'Escape') { setActiveModal(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSendMessage = async (text, client_message_id) => {
    if (!activeThreadId) return;
    const threadIdStr = String(activeThreadId);
    const newMsg = {
      client_message_id,
      content: text,
      is_outgoing: true,
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    setMessages(prev => ({ ...prev, [threadIdStr]: [...(prev[threadIdStr] || []), newMsg] }));

    if (socket && isConnected) {
      socket.emit('SEND_MESSAGE', { thread_id: threadIdStr, content: text, client_message_id });
    } else {
      setMessages(prev => ({
        ...prev,
        [threadIdStr]: (prev[threadIdStr] || []).map(m => m.client_message_id === client_message_id ? { ...m, status: 'failed' } : m)
      }));
    }
  };

  const handleRetryMessage = (msg) => {
    if (msg?.content) {
      handleSendMessage(msg.content, msg.client_message_id || `retry_${Date.now()}`);
    }
  };

  const handleAssignStaff = async (threadId) => {
    const threadIdStr = String(threadId);
    try {
      await fetch(`/api/threads/${threadIdStr}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: SESSION_USER.id }) });
      setThreads(prev => prev.map(t => String(t.id) === threadIdStr ? { ...t, status: 'ASSIGNED', assigned_user_id: SESSION_USER.id } : t));
    } catch (e) { console.error('Assign error:', e); }
  };

  const handleCompleteThread = async (threadId) => {
    const threadIdStr = String(threadId);
    await fetch(`/api/threads/${threadIdStr}/complete`, { method: 'POST' });
    setThreads(prev => prev.map(t => String(t.id) === threadIdStr ? { ...t, status: 'COMPLETED' } : t));
  };

  const handlePauseAi = async (threadId) => {
    const threadIdStr = String(threadId);
    const res = await fetch(`/api/threads/${threadIdStr}/ai/pause`, { method: 'POST' });
    const data = await res.json();
    setThreads(prev => prev.map(t => String(t.id) === threadIdStr ? { ...t, ai_paused_until: data.until } : t));
  };

  const handleResumeAi = async (threadId) => {
    const threadIdStr = String(threadId);
    await fetch(`/api/threads/${threadIdStr}/ai/resume`, { method: 'POST' });
    setThreads(prev => prev.map(t => String(t.id) === threadIdStr ? { ...t, ai_paused_until: null } : t));
  };

  const handleSaveContact = async (updatedContact) => {
    const contactThreadId = String(updatedContact.thread_id);
    setContacts(prev => ({ ...prev, [contactThreadId]: updatedContact }));
    await fetch(`/api/contacts/${contactThreadId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedContact) }).catch(console.error);
  };

  const handleExportLeads = async (format = 'excel') => {
    const res = await fetch(`/api/leads/export/${format}`, { method: 'POST' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads.${format === 'excel' ? 'xlsx' : 'csv'}`; a.click();
    URL.revokeObjectURL(url);
  };

  const selectedThread = activeThreadId ? (
    threads.find(t => String(t.id) === String(activeThreadId)) || threads.find(t => t.id === activeThreadId)
  ) : null;
  const activeMessages = activeThreadId ? (messages[String(activeThreadId)] || []) : [];
  const currentAccount = selectedThread ? accounts.find(a => String(a.id) === String(selectedThread.account_id)) : null;
  const activeContact = activeThreadId && selectedThread ? {
    thread_id: String(activeThreadId),
    name: selectedThread.contact_name || selectedThread.name || 'Khách hàng',
    avatar_url: selectedThread.avatar_url,
    status: selectedThread.status,
    account_id: selectedThread.account_id,
    account_name: currentAccount ? (currentAccount.name || currentAccount.id) : selectedThread.account_id,
    ...(contacts[String(activeThreadId)] || {})
  } : null;

  const isCurrentExtensionDisconnected = currentAccount ? currentAccount.is_extension_connected === false : false;

  const gridClass = leadPanelCollapsed ? 'app-grid-collapsed' : 'app-grid';

  return (
    <div className={gridClass}>
      {/* Column 1: Sidebar Navigation - 48px */}
      <AppSidebar
        activeView={activeView} onSelectView={setActiveView}
        onOpenModal={(modalName) => setActiveModal(modalName)}
        theme={theme} onToggleTheme={toggleTheme}
        hasCheckpoint={hasCheckpoint} collapsed={leadPanelCollapsed}
        onToggleCollapse={() => setLeadPanelCollapsed(!leadPanelCollapsed)}
      />

      {/* Column 2: Conversation List */}
      <ConversationSidebar
        threads={threads} activeThreadId={activeThreadId} onSelectThread={setActiveThreadId}
        activeTab={activeTab} onTabChange={setActiveTab}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        isConnected={isConnected} onOpenSearch={() => setActiveModal('search')}
        accounts={accounts}
      />

      {/* Column 3: Chat Area */}
      <div className="chat-area bg-[var(--color-bg-app)] flex flex-col h-full">
        {activeThreadId && selectedThread ? (
          <div className="chat-thread flex flex-col h-full flex-1 min-h-0">
            <ChatHeader
              activeThread={selectedThread}
              accounts={accounts}
              onAssignStaff={handleAssignStaff} onCompleteThread={handleCompleteThread}
              onPauseAi={handlePauseAi} onResumeAi={handleResumeAi}
              onOpenSearch={() => setActiveModal('search')}
              onShowLeadPanel={() => setShowLeadDrawer(true)}
              showBackButton={isMobile}
              onGoBack={() => { setActiveThreadId(null); }}
            />
            <MessageList
              messages={activeMessages}
              activeThread={selectedThread}
              onSyncThread={() => socket?.emit('REQUEST_SYNC_THREADS', { account_id: selectedThread?.account_id })}
              onRetryMessage={handleRetryMessage}
            />
            <MessageComposer
              onSendMessage={handleSendMessage}
              disabled={isCurrentExtensionDisconnected}
            />
          </div>
        ) : (
          <EmptyState icon={MessageSquare} title="Chọn một hội thoại để bắt đầu nhắn tin" description="Tin nhắn và thông tin khách hàng sẽ xuất hiện tại đây." />
        )}
      </div>

      {/* Column 4: Lead Details Panel */}
      {!leadPanelCollapsed && !isNarrow && (
        <LeadDetailsPanel contactInfo={activeContact} onSaveContact={handleSaveContact} onExportLeads={handleExportLeads} />
      )}

      {/* Lead Drawer for ≤1199px */}
      {showLeadDrawer && (
        <>
          <div className="lead-drawer-backdrop open" onClick={() => setShowLeadDrawer(false)} role="presentation" />
          <div className="lead-drawer open" role="dialog" aria-modal="true">
            <LeadDetailsPanel contactInfo={activeContact} onSaveContact={handleSaveContact} onExportLeads={handleExportLeads} onCloseDrawer={() => setShowLeadDrawer(false)} />
          </div>
        </>
      )}

      {/* Modals */}
      {activeModal === 'search' && <SearchOverlay onClose={() => setActiveModal(null)} onSelectThread={(tid) => { setActiveThreadId(tid); setActiveModal(null); }} />}
      {activeModal === 'accounts' && <AccountManagerModal onClose={() => { setActiveModal(null); loadAccounts(); }} />}
      {activeModal === 'autoReply' && <AutoReplyModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'broadcast' && <BroadcastModal threads={threads} socket={socket} onClose={() => setActiveModal(null)} />}
      {activeModal === 'aiConfig' && <AiConfigModal onClose={() => setActiveModal(null)} />}
    </div>
  );
}
