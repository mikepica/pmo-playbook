import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'viewer';
  department?: string;
  permissions: {
    canCreateProposals: boolean;
    canApproveProposals: boolean;
    canEditSOPs: boolean;
    canViewAnalytics: boolean;
  };
  preferences: {
    defaultView?: string;
    emailNotifications: boolean;
    theme?: 'light' | 'dark';
  };
  lastLogin?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionsSchema = new Schema({
  canCreateProposals: {
    type: Boolean,
    default: true
  },
  canApproveProposals: {
    type: Boolean,
    default: false
  },
  canEditSOPs: {
    type: Boolean,
    default: false
  },
  canViewAnalytics: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const PreferencesSchema = new Schema({
  defaultView: String,
  emailNotifications: {
    type: Boolean,
    default: true
  },
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  }
}, { _id: false });

const UserSchema = new Schema<IUser>({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: function() {
      return `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'viewer'],
    default: 'user',
    index: true
  },
  department: {
    type: String,
    trim: true
  },
  permissions: {
    type: PermissionsSchema,
    default: () => ({})
  },
  preferences: {
    type: PreferencesSchema,
    default: () => ({})
  },
  lastLogin: Date,
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Pre-save middleware to set permissions based on role
UserSchema.pre('save', function(next) {
  if (this.isModified('role')) {
    switch (this.role) {
      case 'admin':
        this.permissions = {
          canCreateProposals: true,
          canApproveProposals: true,
          canEditSOPs: true,
          canViewAnalytics: true
        };
        break;
      case 'viewer':
        this.permissions = {
          canCreateProposals: false,
          canApproveProposals: false,
          canEditSOPs: false,
          canViewAnalytics: true
        };
        break;
      default: // 'user'
        this.permissions = {
          canCreateProposals: true,
          canApproveProposals: false,
          canEditSOPs: false,
          canViewAnalytics: false
        };
    }
  }
  next();
});

// Static method to find active users by role
UserSchema.statics.findActiveByRole = function(role: string) {
  return this.find({ role, isActive: true }).sort({ name: 1 });
};

// Instance method to update last login
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Instance method to check permission
UserSchema.methods.hasPermission = function(permission: keyof IUser['permissions']): boolean {
  return this.permissions[permission] || false;
};

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;