const qs = require('querystring');
const config = require('config');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const LevelStore = require('level-session-store')(session);
const flash = require('connect-flash');
const csurf = require('csurf');
const paramCase = require('param-case');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

function notAuthenticated(req, res, next) {
  if (req.user) {
    res.redirect('/');
  } else {
    next();
  }
}

module.exports = (db, users, message) => {
  passport.use(new LocalStrategy((username, password, done) => {
    users.findByUsername(username)
      .then(user => users.checkPassword(user.id, password)
        .then((isCorrect) => {
          if (!isCorrect) {
            done(null, false, { message: 'Credentials are invalid.' });
          } else {
            done(null, user);
          }
        }))
      .catch((error) => {
        if (error.code === 'EUSERNOTFOUND') {
          done(null, false, { message: 'Credentials are invalid.' });
        } else {
          done(error);
        }
      });
  }));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    users.findById(id)
      .then(user => done(null, user))
      .catch((error) => {
        if (error.code === 'EUSERNOTFOUND') {
          done(null, false);
        } else {
          done(error);
        }
      });
  });

  const web = express.Router();
  web.use(express.static('public'));
  web.use(session({
    maxAge: config.get('session.maxAge'),
    resave: false,
    store: new LevelStore(db),
    secret: config.get('session.secret'),
    secure: !!(config.has('session.secure') && config.get('session.secure')),
    saveUninitialized: false,
  }));
  web.use(bodyParser.urlencoded({ extended: false }));
  web.use(csurf());
  web.use(flash());
  web.use(passport.initialize());
  web.use(passport.session());
  web.use((req, res, next) => {
    res.locals.pageName = paramCase(req.path);
    next();
  });

  web.get('/', (req, res) => {
    let myMessage;

    function renderHome() {
      res.render('home', {
        title: 'Home',
        user: req.user,
        message: myMessage,
        loginError: req.flash('login-error'),
        csrfToken: req.csrfToken(),
      });
    }

    message.getMessage(req.user)
      .then((m) => {
        myMessage = m;
        renderHome();
      })
      .catch(() => renderHome());
  });

  web.get('/register', notAuthenticated, (req, res) => {
    res.render('register', {
      title: 'Registration',
      registrationError: req.flash('registration-error'),
      registerFormExtraParams: {
          redirectUrl: req.query.ref ? config.get('routes.associationPath') + '?ref=' + req.query.ref : '/' ,
        },
      csrfToken: req.csrfToken(),
    });
  });

  web.post('/login', (req, res, next) => {
    passport.authenticate('local', {
      successRedirect: req.body.redirectUrl || '/',
      failureRedirect: req.get('Referrer') || '/',
      failureFlash: { type: 'login-error' },
    })(req, res, next);
  });

  web.post('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
  });

  web.post('/register', (req, res) => {
    if (!req.body.password || !req.body.confirmPassword ||
        req.body.password !== req.body.confirmPassword) {
      req.flash('registration-error', 'Password and confirm password fields must match.');
      res.redirect('/register');
      return;
    }
    users.register({
      username: req.body.username,
      password: req.body.password,
    })
      .then((user) => {
        req.login(user, (loginError) => {
          if (loginError) {
            throw new Error('User was created but could not be logged in.');
          }
          res.redirect(req.body.redirectUrl || '/');
        });
      })
      .catch((error) => {
        req.flash('registration-error', `An error occurred: ${error.message}`);
        res.redirect('/register');
      });
  });

  web.get(config.get('routes.associationPath'), (req, res) => {
    res.locals.title = 'Slack User Association';
    if (!req.user) {
      res.render('association', {
        mainMessage: 'You must login before user association can be completed.',
        renderLoginForm: true,
        nonce: req.query.ref,
        loginFormExtraParams: {
          redirectUrl: req.originalUrl,
        },
        loginError: req.flash('login-error'),
        csrfToken: req.csrfToken(),
      });
    } else {
      if (req.user.slack) {
        res.render('association', {
          mainMessage: 'Your user account is already associated with a Slack user.',
        });
      } else if (req.query.ref) {
        users.completeSlackAssociation(req.user.id, req.query.ref)
          .then(() => {
            res.render('association', {
              mainMessage: 'Your user account has successfully been associated with your Slack user.',
              redirectUrl: '/',
            });
          })
          .catch((error) => {
            res.render('association', {
              mainMessage: `An error occurred: ${error.message}`,
            });
          });
      } else {
        // You might want to supply an alternative user association flow with Sign In With Slack
        res.render('association', {
          mainMessage: 'You must begin the user association process before visiting this page.',
        });
      }
    }
  });

  return web;
};
