/**
 * ADV-013: RBAC System - Role-Based Access Control
 * 
 * @version 1.0.0
 * @since 7.9.14
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'whl_rbac'
  };

  const PERMISSIONS = {
    // AI Features
    AI_RESPOND: 'ai:respond',
    AI_TRAIN: 'ai:train',
    AI_CONFIG: 'ai:config',
    
    // Data
    DATA_VIEW: 'data:view',
    DATA_EXPORT: 'data:export',
    DATA_DELETE: 'data:delete',
    
    // Contacts
    CONTACTS_VIEW: 'contacts:view',
    CONTACTS_EDIT: 'contacts:edit',
    CONTACTS_DELETE: 'contacts:delete',
    
    // Campaigns
    CAMPAIGNS_VIEW: 'campaigns:view',
    CAMPAIGNS_CREATE: 'campaigns:create',
    CAMPAIGNS_MANAGE: 'campaigns:manage',
    
    // Team
    TEAM_VIEW: 'team:view',
    TEAM_MANAGE: 'team:manage',
    
    // System
    SYSTEM_CONFIG: 'system:config',
    SYSTEM_ADMIN: 'system:admin'
  };

  const DEFAULT_ROLES = {
    admin: {
      id: 'admin',
      name: 'Administrador',
      description: 'Acesso total ao sistema',
      permissions: Object.values(PERMISSIONS)
    },
    manager: {
      id: 'manager',
      name: 'Gerente',
      description: 'Gerencia equipe e configurações',
      permissions: [
        PERMISSIONS.AI_RESPOND, PERMISSIONS.AI_TRAIN, PERMISSIONS.AI_CONFIG,
        PERMISSIONS.DATA_VIEW, PERMISSIONS.DATA_EXPORT,
        PERMISSIONS.CONTACTS_VIEW, PERMISSIONS.CONTACTS_EDIT,
        PERMISSIONS.CAMPAIGNS_VIEW, PERMISSIONS.CAMPAIGNS_CREATE, PERMISSIONS.CAMPAIGNS_MANAGE,
        PERMISSIONS.TEAM_VIEW, PERMISSIONS.TEAM_MANAGE
      ]
    },
    operator: {
      id: 'operator',
      name: 'Operador',
      description: 'Atendimento ao cliente',
      permissions: [
        PERMISSIONS.AI_RESPOND,
        PERMISSIONS.DATA_VIEW,
        PERMISSIONS.CONTACTS_VIEW, PERMISSIONS.CONTACTS_EDIT,
        PERMISSIONS.CAMPAIGNS_VIEW
      ]
    },
    viewer: {
      id: 'viewer',
      name: 'Visualizador',
      description: 'Apenas visualização',
      permissions: [
        PERMISSIONS.DATA_VIEW,
        PERMISSIONS.CONTACTS_VIEW,
        PERMISSIONS.CAMPAIGNS_VIEW
      ]
    }
  };

  class RBACSystem {
    constructor() {
      this.roles = new Map();
      this.users = new Map();
      this.currentUser = null;
      this.initialized = false;
    }

    async init() {
      await this._loadData();
      this.initialized = true;
      console.log('[RBAC] Initialized');
    }

    async _loadData() {
      try {
        const data = await this._getStorage(CONFIG.STORAGE_KEY);
        if (data) {
          this.roles = new Map(Object.entries(data.roles || DEFAULT_ROLES));
          this.users = new Map(Object.entries(data.users || {}));
          this.currentUser = data.currentUser;
        } else {
          for (const [id, role] of Object.entries(DEFAULT_ROLES)) {
            this.roles.set(id, role);
          }
        }
      } catch (e) {
        for (const [id, role] of Object.entries(DEFAULT_ROLES)) {
          this.roles.set(id, role);
        }
      }
    }

    async _saveData() {
      await this._setStorage(CONFIG.STORAGE_KEY, {
        roles: Object.fromEntries(this.roles),
        users: Object.fromEntries(this.users),
        currentUser: this.currentUser
      });
    }

    _getStorage(key) {
      return new Promise(r => {
        if (typeof chrome !== 'undefined' && chrome.storage)
          chrome.storage.local.get([key], res => r(res[key]));
        else r(null);
      });
    }

    _setStorage(key, value) {
      return new Promise(r => {
        if (typeof chrome !== 'undefined' && chrome.storage)
          chrome.storage.local.set({ [key]: value }, r);
        else r();
      });
    }

    /**
     * Verifica se tem permissão
     */
    hasPermission(permission, userId = null) {
      const user = userId ? this.users.get(userId) : this.getCurrentUser();
      if (!user) return false;

      const role = this.roles.get(user.roleId);
      if (!role) return false;

      return role.permissions.includes(permission) || 
             role.permissions.includes(PERMISSIONS.SYSTEM_ADMIN);
    }

    /**
     * Verifica múltiplas permissões (AND)
     */
    hasAllPermissions(permissions, userId = null) {
      return permissions.every(p => this.hasPermission(p, userId));
    }

    /**
     * Verifica múltiplas permissões (OR)
     */
    hasAnyPermission(permissions, userId = null) {
      return permissions.some(p => this.hasPermission(p, userId));
    }

    /**
     * Obtém usuário atual
     */
    getCurrentUser() {
      return this.currentUser ? this.users.get(this.currentUser) : null;
    }

    /**
     * Define usuário atual
     */
    setCurrentUser(userId) {
      if (this.users.has(userId)) {
        this.currentUser = userId;
        this._saveData();
        return true;
      }
      return false;
    }

    /**
     * Cria usuário
     */
    async createUser(config) {
      // SECURITY FIX (PARTIAL-014): Require TEAM_MANAGE permission to create users
      if (!this.hasPermission(PERMISSIONS.TEAM_MANAGE)) {
        console.error('[RBAC] Permission denied: TEAM_MANAGE required to create users');
        throw new Error('Permission denied: team:manage required');
      }

      const id = `user_${Date.now()}`;
      const user = {
        id,
        name: config.name,
        email: config.email,
        roleId: config.roleId || 'operator',
        createdAt: Date.now(),
        lastActive: null
      };

      this.users.set(id, user);
      await this._saveData();
      return user;
    }

    /**
     * Atualiza papel do usuário
     */
    async updateUserRole(userId, roleId) {
      // SECURITY FIX (PARTIAL-014): Require TEAM_MANAGE permission to change roles
      if (!this.hasPermission(PERMISSIONS.TEAM_MANAGE)) {
        console.error('[RBAC] Permission denied: TEAM_MANAGE required to update user roles');
        throw new Error('Permission denied: team:manage required');
      }

      const user = this.users.get(userId);
      if (!user || !this.roles.has(roleId)) return false;

      user.roleId = roleId;
      await this._saveData();
      return true;
    }

    /**
     * Cria papel personalizado
     */
    async createRole(config) {
      // SECURITY FIX (PARTIAL-014): Require SYSTEM_ADMIN permission to create roles
      if (!this.hasPermission(PERMISSIONS.SYSTEM_ADMIN)) {
        console.error('[RBAC] Permission denied: SYSTEM_ADMIN required to create roles');
        throw new Error('Permission denied: system:admin required');
      }

      const id = `role_${Date.now()}`;
      const role = {
        id,
        name: config.name,
        description: config.description || '',
        permissions: config.permissions || [],
        createdAt: Date.now()
      };

      this.roles.set(id, role);
      await this._saveData();
      return role;
    }

    /**
     * Atualiza permissões de um papel
     */
    async updateRolePermissions(roleId, permissions) {
      // SECURITY FIX (PARTIAL-014): Require SYSTEM_ADMIN permission to modify permissions
      if (!this.hasPermission(PERMISSIONS.SYSTEM_ADMIN)) {
        console.error('[RBAC] Permission denied: SYSTEM_ADMIN required to update permissions');
        throw new Error('Permission denied: system:admin required');
      }

      const role = this.roles.get(roleId);
      if (!role) return false;

      role.permissions = permissions;
      await this._saveData();
      return true;
    }

    /**
     * Remove usuário
     */
    async deleteUser(userId) {
      // SECURITY FIX (PARTIAL-014): Require TEAM_MANAGE permission to delete users
      if (!this.hasPermission(PERMISSIONS.TEAM_MANAGE)) {
        console.error('[RBAC] Permission denied: TEAM_MANAGE required to delete users');
        throw new Error('Permission denied: team:manage required');
      }

      this.users.delete(userId);
      if (this.currentUser === userId) {
        this.currentUser = null;
      }
      await this._saveData();
      return true;
    }

    /**
     * Lista usuários
     */
    listUsers() {
      return Array.from(this.users.values()).map(u => ({
        ...u,
        role: this.roles.get(u.roleId)
      }));
    }

    /**
     * Lista papéis
     */
    listRoles() {
      return Array.from(this.roles.values());
    }

    /**
     * Lista permissões disponíveis
     */
    listPermissions() {
      return Object.entries(PERMISSIONS).map(([key, value]) => ({
        key,
        permission: value,
        description: this._getPermissionDescription(value)
      }));
    }

    _getPermissionDescription(permission) {
      const descriptions = {
        [PERMISSIONS.AI_RESPOND]: 'Usar IA para responder',
        [PERMISSIONS.AI_TRAIN]: 'Treinar IA',
        [PERMISSIONS.AI_CONFIG]: 'Configurar IA',
        [PERMISSIONS.DATA_VIEW]: 'Visualizar dados',
        [PERMISSIONS.DATA_EXPORT]: 'Exportar dados',
        [PERMISSIONS.DATA_DELETE]: 'Deletar dados',
        [PERMISSIONS.CONTACTS_VIEW]: 'Ver contatos',
        [PERMISSIONS.CONTACTS_EDIT]: 'Editar contatos',
        [PERMISSIONS.CONTACTS_DELETE]: 'Deletar contatos',
        [PERMISSIONS.CAMPAIGNS_VIEW]: 'Ver campanhas',
        [PERMISSIONS.CAMPAIGNS_CREATE]: 'Criar campanhas',
        [PERMISSIONS.CAMPAIGNS_MANAGE]: 'Gerenciar campanhas',
        [PERMISSIONS.TEAM_VIEW]: 'Ver equipe',
        [PERMISSIONS.TEAM_MANAGE]: 'Gerenciar equipe',
        [PERMISSIONS.SYSTEM_CONFIG]: 'Configurar sistema',
        [PERMISSIONS.SYSTEM_ADMIN]: 'Administrador do sistema'
      };
      return descriptions[permission] || permission;
    }

    /**
     * Decorator para proteger funções
     */
    requirePermission(permission) {
      return (target, key, descriptor) => {
        const original = descriptor.value;
        descriptor.value = (...args) => {
          if (!this.hasPermission(permission)) {
            throw new Error(`Permission denied: ${permission}`);
          }
          return original.apply(target, args);
        };
        return descriptor;
      };
    }

    /**
     * Wrapper para proteger funções
     */
    protect(fn, permission) {
      return (...args) => {
        if (!this.hasPermission(permission)) {
          console.warn(`[RBAC] Permission denied: ${permission}`);
          return null;
        }
        return fn(...args);
      };
    }

    getStats() {
      return {
        totalUsers: this.users.size,
        totalRoles: this.roles.size,
        currentUser: this.getCurrentUser()?.name
      };
    }
  }

  const rbac = new RBACSystem();
  rbac.init();

  window.WHLRBAC = rbac;
  window.WHLPermissions = PERMISSIONS;
  console.log('[ADV-013] RBAC System initialized');

})();
