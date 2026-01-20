const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === 'nodemailer') {
    return {
      createTransport: () => ({
        sendMail: async (options) => {
          console.log('Mock sendMail called with:', options);
          return 'Mock Success';
        }
      })
    };
  }
  return originalRequire.apply(this, arguments);
};

const emailService = require('./services/emailService');

console.log('Exports:', Object.keys(emailService));

async function test() {
  if (typeof emailService.sendTeacherSignoffMail === 'function' &&
      typeof emailService.sendTASignoffMail === 'function' &&
      typeof emailService.sendApprovalNotification === 'function') {
    console.log('Verification Successful: All functions exported correctly.');
    
    // Test execution
    try {
        await emailService.sendTASignoffMail({
            taEmail: 'test@example.com',
            borrowId: 123,
            baseUrl: 'http://localhost'
        });
        console.log('Test function execution successful.');
    } catch (e) {
        console.error('Test execution failed:', e);
        process.exit(1);
    }
    
  } else {
    console.error('Verification Failed: Missing exports.');
    process.exit(1);
  }
}

test();
