import { supabase } from '@/lib/supabase';
import {
  Tool,
  ToolAction,
  ToolWithConnection,
  UserToolConnection,
  StartConnectionResponse,
  CheckStatusResponse,
  DisconnectResponse,
} from '@/types/tools';

/**
 * Fetch active tools directly from Supabase `tools` table.
 */
export const fetchToolsFromSupabase = async (): Promise<Tool[]> => {
  const { data, error } = await supabase.functions.invoke('agent-run', { body: { mode: 'tools_catalog' } });

  if (error) {
    console.error('[tools.ts] Supabase query error fetching tools:', error.message);
    throw error;
  }

  if (data?.ok !== true || !Array.isArray(data.tools)) throw new Error(data?.message || 'The tool catalog could not be verified.');
  return data.tools as Tool[];
};

/**
 * Fetch tool connections for a specific user from Supabase `user_tool_connections` table.
 */
export const getUserToolConnections = async (
  userId: string
): Promise<UserToolConnection[]> => {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_tool_connections')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return (data as UserToolConnection[]) || [];
};

/**
 * Main service function to fetch tools directly from Supabase combined with current user's connection status.
 *
 * Does NOT use mock tools.
 *
 * @param userId - Optional Supabase Auth user ID. If not provided, will attempt to fetch current auth user.
 * @returns Array of ToolWithConnection from Supabase database.
 */
export const fetchToolsWithUserConnection = async (
  userId?: string
): Promise<ToolWithConnection[]> => {
  // 1. Fetch active tools from Supabase
  const tools = await fetchToolsFromSupabase();

  if (!tools || tools.length === 0) {
    return [];
  }

  // 2. Resolve user ID if not explicitly passed
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: authData } = await supabase.auth.getUser();
    activeUserId = authData?.user?.id;
  }

  // 3. Fetch user connections if authenticated user exists
  let connections: UserToolConnection[] = [];
  if (activeUserId) {
    connections = await getUserToolConnections(activeUserId);
  }

  // Map connections by tool_id for fast lookup
  const connectionMap = new Map<string, UserToolConnection>();
  connections.forEach((conn) => {
    connectionMap.set(conn.tool_id, conn);
  });

  // 4. Combine Supabase tool data with user connection status
  const result: ToolWithConnection[] = tools.map((tool) => {
    const conn = connectionMap.get(tool.id);

    // Parse actions safely if stored as JSON/string
    let parsedActions: ToolAction[] = [];
    if (Array.isArray(tool.actions)) {
      parsedActions = tool.actions;
    } else if (typeof tool.actions === 'string') {
      try {
        parsedActions = JSON.parse(tool.actions);
      } catch {
        parsedActions = [];
      }
    }

    return {
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      toolkit_slug: tool.toolkit_slug,
      description: tool.description,
      category: tool.category,
      logo_url: tool.logo_url,
      icon_url: (tool as any).icon_url || tool.logo_url || null,
      logo_key: tool.logo_key,
      actions: parsedActions,
      status: conn ? conn.status : 'not_connected',
      connected_label: conn ? conn.connected_label : null,
      connected_email: conn ? conn.connected_email : null,
      composio_auth_config_id: tool.composio_auth_config_id,
      enabled: tool.enabled,
      availability: tool.availability,
      availability_reason: tool.availability_reason,
      composio_connected_account_id: conn ? conn.composio_connected_account_id : null,
    };
  });

  return result;
};

/**
 * Requirement 1: Connected tools context helper.
 * Returns active connected tools for the current user with details:
 * - toolkit_slug
 * - tool name
 * - actions
 * - composio_connected_account_id
 * - connected_label
 */
export const getConnectedToolsContext = async (
  userId?: string
): Promise<import('@/types/tools').ConnectedToolContext[]> => {
  const toolsWithConn = await fetchToolsWithUserConnection(userId);
  return toolsWithConn
    .filter((t) => t.status === 'connected')
    .map((t) => ({
      tool_id: t.id,
      name: t.name,
      slug: t.slug,
      toolkit_slug: t.toolkit_slug,
      actions: t.actions,
      composio_connected_account_id: t.composio_connected_account_id || null,
      connected_label: t.connected_label || null,
      connected_email: t.connected_email || null,
    }));
};

/**
 * Requirement 6: Tool run logging helper.
 * Logs tool execution details to `agent_tool_runs` table in Supabase.
 */
export const logToolRun = async (
  log: import('@/types/tools').AgentToolRunLog
): Promise<any> => {
  let userId = log.user_id;
  if (!userId) {
    const { data: authData } = await supabase.auth.getUser();
    userId = authData?.user?.id || '';
  }

  if (!userId) {
    throw new Error('Cannot log tool run without an authenticated user.');
  }

  const payload = {
    user_id: userId,
    tool_id: log.tool_id || null,
    action_name: log.action_name,
    input_summary: log.input_summary,
    output_summary: log.output_summary || null,
    status: log.status,
    error_message: log.error_message || null,
    metadata: log.metadata || {},
  };

  const { data, error } = await supabase
    .from('agent_tool_runs')
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Helper to execute backend endpoint requests with Auth token.
 */
async function callToolApi<T = any>(
  endpointPath: string,
  options: { method?: string; body?: any } = {}
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const match = endpointPath.match(/^\/api\/tools\/([^/]+)\/(connect|status|disconnect)$/);
  if (!match || !token) throw new Error('Sign in to manage connections.');
  const { data, error } = await supabase.functions.invoke('agent-run', {
    body: { ...options.body, toolId: decodeURIComponent(match[1]), mode: `tool_${match[2]}` },
    timeout: 70000,
  });
  if (error) {
    const details = await error.context?.json?.().catch(() => null);
    throw new Error(details?.message || 'The secure connection service is unavailable.');
  }
  if (data?.success !== true) throw new Error(data?.message || 'The connection could not be verified.');
  return data as T;
}

/**
 * 1. Start Composio Connection
 * POST /tools/:toolId/connect (or /api/tools/:toolId/connect)
 */
export const startToolConnectionApi = async (
  toolId: string,
  callbackTarget: 'native' | 'hosted' | 'web' = 'native'
): Promise<StartConnectionResponse> => {
  return callToolApi<StartConnectionResponse>(
    `/api/tools/${encodeURIComponent(toolId)}/connect`,
    {
      method: 'POST',
      body: { callbackTarget },
    }
  );
};

/**
 * 2. Check Connection Status
 * GET /tools/:toolId/status (or /api/tools/:toolId/status)
 */
export const checkToolConnectionStatusApi = async (
  toolId: string
): Promise<CheckStatusResponse> => {
  return callToolApi<CheckStatusResponse>(
    `/api/tools/${encodeURIComponent(toolId)}/status`,
    {
      method: 'GET',
    }
  );
};

/**
 * 3. Disconnect Tool Connection
 * POST /tools/:toolId/disconnect (or /api/tools/:toolId/disconnect)
 */
export const disconnectToolApi = async (
  toolId: string
): Promise<DisconnectResponse> => {
  return callToolApi<DisconnectResponse>(
    `/api/tools/${encodeURIComponent(toolId)}/disconnect`,
    {
      method: 'POST',
    }
  );
};
