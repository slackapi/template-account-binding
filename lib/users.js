const url = require('url');
const config = require('config');
const uuid = require('uuid');
const randomstring = require('randomstring');
const bcrypt = require('bcrypt');
const SlackWebClient = require('@slack/client').WebClient;

// The shape of a user object:
// {
//   id: '',
//   username: '',
//   passwordHash: '',
//   slack: {
//     id: '',
//     dmChannelId: '',
//   },
// }

const slack = new SlackWebClient(config.get('slack.botToken'));

function dataStoreOperation(store, op, ...params) {
  return new Promise((resolve, reject) => {
    params.push({ valueEncoding: 'json' });
    params.push((error, result) => {
      if (error) return reject(error);
      return resolve(result);
    });
    store[op](...params);
  });
}

module.exports = (db) => {
  const userStore = db.sublevel('userlist');
  const linkStore = db.sublevel('associationlinklist');

  function searchUsers(predicate) {
    return new Promise((resolve, reject) => {
      let foundItem;
      userStore.createValueStream({ valueEncoding: 'json' })
        .on('data', function onData(item) {
          if (!foundItem && predicate(item)) {
            foundItem = item;
            this.destroy();
            resolve(foundItem);
          }
        })
        .on('close', () => {
          if (!foundItem) {
            const notFoundError = new Error('User not found');
            notFoundError.code = 'EUSERNOTFOUND';
            reject(notFoundError);
          }
        })
        .on('error', reject);
    });
  }

  return {
    findById(id) {
      return dataStoreOperation(userStore, 'get', id)
        .catch((error) => {
          if (error.notFound) {
            const notFoundError = new Error('User not found');
            notFoundError.code = 'EUSERNOTFOUND';
            throw notFoundError;
          }
          throw error;
        });
    },

    setById(id, user) {
      return dataStoreOperation(userStore, 'put', id, user).then(() => user);
    },

    findByUsername(username) {
      return searchUsers(user => user.username === username);
    },

    findBySlackId(slackId) {
      return searchUsers(user => user.slack && user.slack.id === slackId);
    },

    checkPassword(userId, password) {
      return this.findById(userId)
        .then(user => new Promise((resolve, reject) => {
          bcrypt.compare(password, user.passwordHash, (hashError, res) => {
            if (hashError) {
              reject(hashError);
            } else {
              resolve(!!res);
            }
          });
        }));
    },

    register({ username, password }) {
      // Validations
      // NOTE: more validations would be necessary for a production app, such as password length
      // and/or complexity
      if (!username) {
        return Promise.reject(new Error('A username is required'));
      }
      if (!password) {
        return Promise.reject(new Error('A password is required'));
      }

      return this.findByUsername(username)
        .then(() => Promise.reject(new Error('The username is not available')))
        .catch((findError) => {
          if (findError.code !== 'EUSERNOTFOUND') {
            throw findError;
          }
          return new Promise((resolve, reject) => {
            bcrypt.hash(password, 10, (hashError, passwordHash) => {
              if (hashError) {
                reject(hashError);
              }
              const user = {
                id: uuid(),
                username,
                passwordHash,
              };
              resolve(this.setById(user.id, user));
            });
          });
        });
    },

    beginSlackAssociation(slackUserId) {
      const associationLink = {
        ref: randomstring.generate(),
        slackUserId,
      };
      return slack.im.open(slackUserId)
        .then((r) => {
          associationLink.dmChannelId = r.channel.id;
          const authUrl = config.get('server');
          authUrl.pathname = config.get('routes.associationPath');
          authUrl.query = { ref: associationLink.ref };
          const slackMessage = slack.chat.postMessage(associationLink.dmChannelId,
            'Hello, new friend! I think it\'s time we introduce ourselves. I\'m a bot that helps you access your internal protected resources.',
            {
              attachments: [
                {
                  text: `<${url.format(authUrl)}|Click here> to introduce yourself to me by authenticating.`,
                },
              ],
            }
          );
          const saveLink = dataStoreOperation(linkStore, 'put', associationLink.ref, associationLink);
          return Promise.all([slackMessage, saveLink]);
        })
        .then(() => associationLink.ref);
    },

    completeSlackAssociation(userId, associationRef) {
      return dataStoreOperation(linkStore, 'get', associationRef)
        .catch((error) => {
          if (error.notFound) {
            throw new Error('The user association link was not valid.');
          } else {
            throw error;
          }
        })
        .then(associationLink => Promise.all([
          this.findById(userId)
            .then(user => this.setById(userId, Object.assign(user, {
              slack: { id: associationLink.slackUserId, dmChannelId: associationLink.dmChannelId },
            }))),
          slack.chat.postMessage(associationLink.dmChannelId, 'Well, it\'s nice to meet you! Thanks for completing authentication.'),
        ]))
        .then(() => dataStoreOperation(linkStore, 'del', associationRef));
    },
  };
};
