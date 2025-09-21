const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    otp: {
        type: String,
        required: true,
        length: 6
    },
    attempts: {
        type: Number,
        default: 0,
        max: 3
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
        }
    }
});

// Indexes for performance and auto-cleanup
passwordResetSchema.index({ userId: 1 });
passwordResetSchema.index({ email: 1 });
passwordResetSchema.index({ otp: 1 });
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired documents

// Static method to generate OTP
passwordResetSchema.statics.generateOTP = function() {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Static method to create new reset request
passwordResetSchema.statics.createResetRequest = async function(userId, email) {
    // Delete any existing reset requests for this user
    await this.deleteMany({ userId: userId });
    
    // Generate new OTP
    const otp = this.generateOTP();
    
    // Create new reset request
    const resetRequest = new this({
        userId: userId,
        email: email,
        otp: otp
    });
    
    await resetRequest.save();
    return { otp, resetRequest };
};

// Static method to verify OTP
passwordResetSchema.statics.verifyOTP = async function(email, inputOTP) {
    // Find active reset request
    const resetRequest = await this.findOne({
        email: email.toLowerCase(),
        isUsed: false,
        expiresAt: { $gt: new Date() }
    });
    
    if (!resetRequest) {
        return {
            success: false,
            message: 'No valid OTP found. Please request a new one.'
        };
    }
    
    // Check if too many attempts
    if (resetRequest.attempts >= 3) {
        await resetRequest.deleteOne();
        return {
            success: false,
            message: 'Too many failed attempts. Please request a new OTP.'
        };
    }
    
    // Verify OTP
    if (resetRequest.otp !== inputOTP.toString()) {
        resetRequest.attempts += 1;
        await resetRequest.save();
        
        return {
            success: false,
            message: `Invalid OTP. ${3 - resetRequest.attempts} attempts remaining.`,
            attemptsLeft: 3 - resetRequest.attempts
        };
    }
    
    // OTP is correct
    return {
        success: true,
        message: 'OTP verified successfully.',
        userId: resetRequest.userId,
        resetRequestId: resetRequest._id
    };
};

// Static method to mark OTP as used
passwordResetSchema.statics.markAsUsed = async function(resetRequestId) {
    await this.findByIdAndUpdate(resetRequestId, { isUsed: true });
};

// Static method to check rate limiting
passwordResetSchema.statics.canRequestOTP = async function(email) {
    // Check if there's a recent request (within 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentRequest = await this.findOne({
        email: email.toLowerCase(),
        createdAt: { $gt: twoMinutesAgo }
    });
    
    if (recentRequest) {
        const waitTime = Math.ceil((recentRequest.createdAt.getTime() + 2 * 60 * 1000 - Date.now()) / 1000);
        return {
            canRequest: false,
            waitTime: waitTime, // seconds
            message: `Please wait ${Math.ceil(waitTime / 60)} minute(s) before requesting another OTP.`
        };
    }
    
    return { canRequest: true };
};

// Static method to cleanup expired/used requests for a user
passwordResetSchema.statics.cleanupUserRequests = async function(userId) {
    await this.deleteMany({
        $or: [
            { userId: userId, isUsed: true },
            { userId: userId, expiresAt: { $lt: new Date() } }
        ]
    });
};

// Instance method to check if OTP is expired
passwordResetSchema.methods.isExpired = function() {
    return this.expiresAt < new Date();
};

// Instance method to check if OTP is still valid
passwordResetSchema.methods.isValid = function() {
    return !this.isUsed && !this.isExpired() && this.attempts < 3;
};

module.exports = mongoose.model('PasswordReset', passwordResetSchema);