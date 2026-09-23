import { ChatProvider } from '@/chat/ChatContext'
import DashboardLayout from './DashboardLayout'

/**
 * Lazy dashboard entry: mounts the chat provider around the dashboard only.
 * The traveler chat (socket + conversation state + code) is intentionally
 * confined to /dashboard/* — it must not run anywhere else in the app.
 */
export default function DashboardApp() {
  return (
    <ChatProvider>
      <DashboardLayout />
    </ChatProvider>
  )
}
