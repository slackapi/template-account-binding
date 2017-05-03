const messageKey = 'MESSAGE';
const initialValue = 'Hello World';
const selfCredential = Symbol('self');

module.exports = (db, users) => {
  // Basic authorization system. Your app might choose ACLs or some more sophisticated mechanism.
  function isUser(credential) {
    return users.findById(credential.id).then(() => true).catch(() => false);
  }

  function authorizeSelfOrUser(credential) {
    let authorizationPromise;
    if (credential === selfCredential) {
      authorizationPromise = Promise.resolve(true);
    } else {
      authorizationPromise = isUser(credential);
    }
    return authorizationPromise;
  }

  return {
    initialize() {
      return this.setMessage(initialValue, selfCredential);
    },

    getMessage(credential = {}) {
      return authorizeSelfOrUser(credential)
        .then((isAuthorized) => {
          if (isAuthorized) {
            return new Promise((resolve, reject) => {
              db.get(messageKey, (error, message) => {
                if (error) {
                  if (error.notFound) {
                    resolve(this.initialize());
                  } else {
                    reject(error);
                  }
                } else {
                  resolve(message);
                }
              });
            });
          }
          throw new Error('Not Authorized');
        });
    },

    setMessage(newMessage, credential = {}) {
      return authorizeSelfOrUser(credential)
        .then(isAuthorized => new Promise((resolve, reject) => {
          if (isAuthorized) {
            db.put(messageKey, newMessage, (error) => {
              if (error) {
                reject(error);
              } else {
                resolve(newMessage);
              }
            });
          } else {
            reject(new Error('Not Authorized'));
          }
        }));
    },
  };
};
