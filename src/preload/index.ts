import { contextBridge, ipcRenderer } from 'electron'
import {
  IpcChannels,
  type AppSettings,
  type IpcApi,
  type UnreadCountsMap
} from '../shared/ipc-contract'
import type {
  AppId,
  Profile,
  ProfileSessionStatusPayload,
  ViewportBounds,
  WorkspaceThemePayload
} from '../shared/types'
import type {
  DashboardAiModelsResult,
  DashboardAiSettingsView,
  DashboardAiTestResult,
  DashboardChatPage,
  DashboardChatTokenStatus,
  DashboardGlobalConfig,
  DashboardSendMessageResult,
  DashboardSchedulesState,
  DashboardSnapshot,
  DashboardSyncProgressPayload,
  DashboardTeamWorkspace,
  DashboardTeamWorkspaceCandidate,
  InsightHistoryEntryContract,
  RecentActivity,
  ProjectSidebarState,
  SidebarState
} from '../shared/dashboard-contract'

const api: IpcApi = {
  profiles: {
    list: () => ipcRenderer.invoke(IpcChannels.ProfileList),
    create: (displayName: string) => ipcRenderer.invoke(IpcChannels.ProfileCreate, { displayName }),
    delete: (profileId: string) => ipcRenderer.invoke(IpcChannels.ProfileDelete, { profileId }),
    deleteUnsignedDuplicates: () => ipcRenderer.invoke(IpcChannels.ProfileDeleteUnsignedDuplicates),
    clearStuckAuth: () => ipcRenderer.invoke(IpcChannels.ProfileClearStuckAuth),
    cancelAuthBusy: (profileId?: string) =>
      ipcRenderer.invoke(IpcChannels.ProfileCancelAuthBusy, { profileId }),
    clearAll: () => ipcRenderer.invoke(IpcChannels.ProfileClearAll),
    setCustomName: (profileId, customName) =>
      ipcRenderer.invoke(IpcChannels.ProfileSetCustomName, { profileId, customName }),
    setMuted: (profileId, muted) =>
      ipcRenderer.invoke(IpcChannels.ProfileSetMuted, { profileId, muted }),
    reorder: (orderedIds) => ipcRenderer.invoke(IpcChannels.ProfileReorder, { orderedIds }),
    exportMetadata: () => ipcRenderer.invoke(IpcChannels.ProfileExportMetadata),
    importMetadata: (profiles) =>
      ipcRenderer.invoke(IpcChannels.ProfileImportMetadata, { profiles }),
    activate: (profileId: string, bounds: ViewportBounds) =>
      ipcRenderer.invoke(IpcChannels.ProfileActivate, { profileId, bounds }),
    activateApp: (profileId: string, appId: AppId, bounds: ViewportBounds) =>
      ipcRenderer.invoke(IpcChannels.ProfileActivateApp, { profileId, appId, bounds }),
    activateSplit: (primary, secondary) =>
      ipcRenderer.invoke(IpcChannels.ProfileActivateSplit, { primary, secondary }),
    clearSplit: () => ipcRenderer.invoke(IpcChannels.ProfileClearSplit),
    updateBounds: (bounds: ViewportBounds) =>
      ipcRenderer.invoke(IpcChannels.ProfileUpdateBounds, bounds),
    setEmbedVisible: (visible: boolean) =>
      ipcRenderer.invoke(IpcChannels.ProfileSetEmbedVisible, { visible }),
    startGoogleAuth: (profileId: string, bounds?: ViewportBounds) =>
      ipcRenderer.invoke(IpcChannels.ProfileStartGoogleAuth, { profileId, bounds }),
    startAppLogin: (profileId: string, appId: AppId, bounds?: ViewportBounds) =>
      ipcRenderer.invoke(IpcChannels.ProfileStartAppLogin, { profileId, appId, bounds }),
    startFirstLogin: (profileId: string, bounds?: ViewportBounds) =>
      ipcRenderer.invoke(IpcChannels.ProfileStartFirstLogin, { profileId, bounds }),
    confirmChromeEmbed: () => ipcRenderer.invoke(IpcChannels.ProfileConfirmChromeEmbed),
    cancelChromeEmbed: () => ipcRenderer.invoke(IpcChannels.ProfileCancelChromeEmbed),
    syncChromeEmbedBounds: (bounds: ViewportBounds) =>
      ipcRenderer.invoke(IpcChannels.ProfileSyncChromeEmbedBounds, bounds),
    syncWorkspaces: (profileId: string, appId: AppId, bounds: ViewportBounds) =>
      ipcRenderer.invoke(IpcChannels.ProfileSyncWorkspaces, { profileId, appId, bounds }),
    pinFromAvailable: (profileId: string, appId: AppId, teamId: string) =>
      ipcRenderer.invoke(IpcChannels.ProfilePinFromAvailable, { profileId, appId, teamId }),
    unpinWorkspace: (profileId: string, appId: AppId, teamId: string) =>
      ipcRenderer.invoke(IpcChannels.ProfileUnpinWorkspace, { profileId, appId, teamId }),
    getCurrentWorkspace: (profileId: string, appId: AppId) =>
      ipcRenderer.invoke(IpcChannels.ProfileGetCurrentWorkspace, { profileId, appId }),
    openWorkspace: (profileId: string, appId: AppId, teamId: string, bounds: ViewportBounds) =>
      ipcRenderer.invoke(IpcChannels.ProfileOpenWorkspace, { profileId, appId, teamId, bounds }),
    onSessionStatusChanged: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: ProfileSessionStatusPayload
      ): void => callback(payload)
      ipcRenderer.on(IpcChannels.ProfileSessionStatusChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannels.ProfileSessionStatusChanged, listener)
    },
    onProfileUpdated: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, profile: Profile): void =>
        callback(profile)
      ipcRenderer.on(IpcChannels.ProfileUpdated, listener)
      return () => ipcRenderer.removeListener(IpcChannels.ProfileUpdated, listener)
    },
    onAuthProgress: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, message: string): void =>
        callback(message)
      ipcRenderer.on(IpcChannels.ProfileAuthProgress, listener)
      return () => ipcRenderer.removeListener(IpcChannels.ProfileAuthProgress, listener)
    },
    onWorkspaceThemeChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: WorkspaceThemePayload): void =>
        callback(payload)
      ipcRenderer.on(IpcChannels.WorkspaceThemeChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannels.WorkspaceThemeChanged, listener)
    },
    onUnreadCountsChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, counts: UnreadCountsMap): void =>
        callback(counts)
      ipcRenderer.on(IpcChannels.UnreadCountsChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannels.UnreadCountsChanged, listener)
    },
    onDeepLink: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { profileId: string; appId?: AppId; teamId?: string }
      ): void => callback(payload)
      ipcRenderer.on(IpcChannels.ProfileDeepLink, listener)
      return () => ipcRenderer.removeListener(IpcChannels.ProfileDeepLink, listener)
    }
  },
  app: {
    getSettings: () => ipcRenderer.invoke(IpcChannels.AppSettingsGet),
    setSettings: (patch: Partial<AppSettings>) =>
      ipcRenderer.invoke(IpcChannels.AppSettingsSet, patch),
    pushRecent: (entry) => ipcRenderer.invoke(IpcChannels.AppPushRecent, entry),
    lock: () => ipcRenderer.invoke(IpcChannels.AppLock),
    unlock: () => ipcRenderer.invoke(IpcChannels.AppUnlock),
    reportActivity: () => ipcRenderer.invoke(IpcChannels.AppIdleActivity),
    checkUpdates: () => ipcRenderer.invoke(IpcChannels.AppCheckUpdates),
    testNotification: () => ipcRenderer.invoke(IpcChannels.AppTestNotification),
    adminStatus: () => ipcRenderer.invoke(IpcChannels.AppAdminStatus),
    adminLogin: (username, password, remember) =>
      ipcRenderer.invoke(IpcChannels.AppAdminLogin, { username, password, remember }),
    adminLogout: () => ipcRenderer.invoke(IpcChannels.AppAdminLogout),
    onLockStateChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, locked: boolean): void =>
        callback(locked)
      ipcRenderer.on(IpcChannels.AppLockStateChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannels.AppLockStateChanged, listener)
    },
    onToast: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, message: string): void =>
        callback(message)
      ipcRenderer.on(IpcChannels.AppToast, listener)
      return () => ipcRenderer.removeListener(IpcChannels.AppToast, listener)
    },
    onSettingsChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings): void =>
        callback(settings)
      ipcRenderer.on(IpcChannels.AppSettingsChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannels.AppSettingsChanged, listener)
    }
  },
  slack: {
    connectWorkspace: (profileId: string) =>
      ipcRenderer.invoke(IpcChannels.OauthStartWorkspaceConnect, { profileId }),
    listWorkspaces: (profileId: string) =>
      ipcRenderer.invoke(IpcChannels.SlackWorkspacesForProfile, { profileId }),
    listChannels: (profileId: string, teamId: string) =>
      ipcRenderer.invoke(IpcChannels.SlackChannelsForWorkspace, { profileId, teamId }),
    listHistory: (profileId: string, teamId: string, channelId: string, limit?: number) =>
      ipcRenderer.invoke(IpcChannels.SlackHistoryForChannel, {
        profileId,
        teamId,
        channelId,
        limit
      })
  },
  dashboard: {
    getSnapshot: () => ipcRenderer.invoke(IpcChannels.DashboardGetSnapshot),
    markViewed: (payload) =>
      ipcRenderer.invoke(IpcChannels.DashboardMarkViewed, payload) as Promise<string>,
    getSchedules: () =>
      ipcRenderer.invoke(IpcChannels.DashboardSchedulesGet) as Promise<DashboardSchedulesState>,
    updateSchedules: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.DashboardSchedulesUpdate,
        payload
      ) as Promise<DashboardSchedulesState>,
    runSchedule: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.DashboardSchedulesRun,
        payload
      ) as Promise<DashboardSchedulesState>,
    onSchedulesChanged: (callback: (state: DashboardSchedulesState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: DashboardSchedulesState): void =>
        callback(state)
      ipcRenderer.on(IpcChannels.DashboardSchedulesChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannels.DashboardSchedulesChanged, listener)
    },
    getAppConfig: () => ipcRenderer.invoke(IpcChannels.DashboardGetAppConfig),
    getHistory: (payload: { projectId: string }) =>
      ipcRenderer.invoke(IpcChannels.DashboardGetHistory, payload) as Promise<
        InsightHistoryEntryContract[]
      >,
    getRecent: () =>
      ipcRenderer.invoke(IpcChannels.DashboardGetRecent) as Promise<RecentActivity[]>,
    listChannels: (payload) => ipcRenderer.invoke(IpcChannels.DashboardListChannels, payload),
    upsertProject: (payload) => ipcRenderer.invoke(IpcChannels.DashboardUpsertProject, payload),
    deleteProject: (payload) => ipcRenderer.invoke(IpcChannels.DashboardDeleteProject, payload),
    syncNow: (payload) => ipcRenderer.invoke(IpcChannels.DashboardSyncNow, payload),
    addManualToken: (payload) => ipcRenderer.invoke(IpcChannels.DashboardAddManualToken, payload),
    validateManualToken: (payload) =>
      ipcRenderer.invoke(IpcChannels.DashboardAddManualToken, payload),
    setView: (payload) => ipcRenderer.invoke(IpcChannels.DashboardViewSet, payload),
    onSnapshotChanged: (callback: (snapshot: DashboardSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: DashboardSnapshot): void =>
        callback(snapshot)
      ipcRenderer.on(IpcChannels.DashboardSnapshotChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannels.DashboardSnapshotChanged, listener)
    },
    onSyncProgress: (callback: (payload: DashboardSyncProgressPayload) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: DashboardSyncProgressPayload
      ): void => callback(payload)
      ipcRenderer.on(IpcChannels.DashboardSyncProgress, listener)
      return () => ipcRenderer.removeListener(IpcChannels.DashboardSyncProgress, listener)
    },
    getSidebarState: (projectId: string) =>
      ipcRenderer.invoke(IpcChannels.DashboardSidebarGet, {
        projectId
      }) as Promise<ProjectSidebarState>,
    setSidebarState: (projectId: string, state: ProjectSidebarState) =>
      ipcRenderer.invoke(IpcChannels.DashboardSidebarSet, { projectId, state }),
    updateSidebarState: (
      projectId: string,
      sidebar: 'left' | 'right',
      patch: Partial<SidebarState>
    ) =>
      ipcRenderer.invoke(IpcChannels.DashboardSidebarUpdate, {
        projectId,
        sidebar,
        patch
      }) as Promise<SidebarState>,
    getMessages: (payload) =>
      ipcRenderer.invoke(IpcChannels.DashboardGetMessages, payload) as Promise<DashboardChatPage>,
    sendMessage: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.DashboardSendMessage,
        payload
      ) as Promise<DashboardSendMessageResult>,
    getChatTokenStatus: (projectId) =>
      ipcRenderer.invoke(
        IpcChannels.DashboardChatTokenStatus,
        projectId
      ) as Promise<DashboardChatTokenStatus>,
    getAiSettings: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.DashboardGetAiSettings,
        payload
      ) as Promise<DashboardAiSettingsView>,
    saveAiSettings: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.DashboardSaveAiSettings,
        payload
      ) as Promise<DashboardAiSettingsView>,
    listAiModels: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.DashboardListAiModels,
        payload
      ) as Promise<DashboardAiModelsResult>,
    testAi: (payload) =>
      ipcRenderer.invoke(IpcChannels.DashboardTestAi, payload) as Promise<DashboardAiTestResult>,
    getGlobalConfig: () =>
      ipcRenderer.invoke(IpcChannels.DashboardConfigGet) as Promise<DashboardGlobalConfig>,
    onConfigChanged: (callback: (config: DashboardGlobalConfig) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, config: DashboardGlobalConfig): void =>
        callback(config)
      ipcRenderer.on(IpcChannels.DashboardConfigChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannels.DashboardConfigChanged, listener)
    },
    getTeamWorkspace: () =>
      ipcRenderer.invoke(IpcChannels.DashboardTeamWorkspaceGet) as Promise<DashboardTeamWorkspace>,
    listTeamWorkspaceCandidates: () =>
      ipcRenderer.invoke(IpcChannels.DashboardTeamWorkspaceCandidates) as Promise<
        DashboardTeamWorkspaceCandidate[]
      >,
    connectTeamWorkspace: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.DashboardTeamWorkspaceConnect,
        payload
      ) as Promise<DashboardTeamWorkspace>,
    setTeamWorkspaceChannels: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.DashboardTeamWorkspaceChannels,
        payload
      ) as Promise<DashboardTeamWorkspace>,
    clearTeamWorkspace: () =>
      ipcRenderer.invoke(IpcChannels.DashboardTeamWorkspaceClear) as Promise<DashboardTeamWorkspace>
  }
}

contextBridge.exposeInMainWorld('api', api)
