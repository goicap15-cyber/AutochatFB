module.exports = {
  // A standard conversation from normal Facebook Messenger
  thread1: {
    id: '100000123456789',
    name: 'John Doe',
    avatar: 'https://example.com/avatar1.jpg',
    url: 'https://www.facebook.com/messages/t/100000123456789'
  },
  
  // A group or another person
  thread2: {
    id: '987654321000001',
    name: 'Jane Smith',
    avatar: 'https://example.com/avatar2.jpg',
    url: 'https://www.facebook.com/messages/t/987654321000001'
  },

  // Some messages for thread 1
  messagesThread1: [
    {
      messageId: 'mid.$cAAABBBB1111',
      sender: '100000123456789',
      text: 'Hello there!',
      timestamp: 1700000000000
    },
    {
      messageId: 'mid.$cAAABBBB2222',
      sender: 'me', // Represents the local user
      text: 'Hi John!',
      timestamp: 1700000050000
    }
  ],

  // Some messages for thread 2
  messagesThread2: [
    {
      messageId: 'mid.$cAAABBBB3333',
      sender: 'me',
      text: 'Are we still on for tomorrow?',
      timestamp: 1700000100000
    },
    {
      messageId: 'mid.$cAAABBBB4444',
      sender: '987654321000001',
      text: 'Yes, absolutely.',
      timestamp: 1700000150000
    }
  ]
};
