const Schmervice = require('schmervice');
const JWT = require('jsonwebtoken');
const _ = require('underscore');
const { OAuth2Client } = require('google-auth-library');
const Boom = require('@hapi/boom');
const CONFIG = require('../config');

module.exports = class UserService extends Schmervice.Service {
  async findById(id, graphFetchRelation = '', txn) {
    const { User } = this.server.models();
    const user = User.query(txn)
      .throwIfNotFound()
      .findById(id)
      .withGraphFetched(graphFetchRelation);
    return user;
  }

  async find(txn) {
    const { User } = this.server.models();
    return User.query(txn);
  }

  async update(id, { rolesList, ...userInfo }, txn) {
    const { User, UserRole } = this.server.models();

    const updateObj = { id, ...userInfo };

    if (rolesList) {
      const roles = await UserRole.query(txn).where({ user_id: id });
      const dbRolesList = _.map(roles, (role) => role.role);
      const newRoles = _.map(rolesList, (r) => {
        if (dbRolesList.indexOf(r) > -1) {
          return _.findWhere(roles, { role: r });
        }
        return { role: r };
      });
      updateObj.roles = newRoles;
    }

    await User.query(txn).upsertGraph(updateObj);

    return id;
  }

  async addRoles(id, rolesList, txn) {
    const { UserRole } = this.server.models();

    const roles = await UserRole.query(txn).where({ user_id: id });

    // check which roles in the rolesList don't exist in db
    const newRoles = _.filter(rolesList, (r) => _.findWhere(roles, { role: r }) === undefined);
    if (newRoles.length !== rolesList.length) {
      throw Boom.forbidden('Some roles given are already assigned to the user.');
    }

    await UserRole.query(txn).insert(_.map(rolesList, (r) => ({ role: r, user_id: id })));
    return id;
  }

  async removeRoles(id, rolesList, txn) {
    const { UserRole } = this.server.models();

    const roles = await UserRole.query(txn).where({ user_id: id });

    // check if the roles list has some roles which are not assigned to the user
    _.forEach(rolesList, (roleName) => {
      const userRole = _.findWhere(roles, { role: roleName });
      if (!userRole) {
        throw Boom.badRequest(`${roleName} is not assigned the user. Cannot remove it.`);
      }
    });

    let rolesToRemove = _.filter(roles, (r) => rolesList.indexOf(r.role) > -1);
    rolesToRemove = _.map(rolesToRemove, (r) => r.id);
    await UserRole.query(txn).deleteById(rolesToRemove);

    return id;
  }

  async loginWithGoogle(idToken, txn) {
    const { User } = this.server.models();
    const googleClient = new OAuth2Client(CONFIG.auth.googleClientID);
    const response = await googleClient.verifyIdToken({
      idToken,
      audience: CONFIG.auth.googleClientID,
    });

    const userObj = {
      email: response.payload.email,
      name: response.payload.name,
      profile_picture: response.payload.picture,
      google_user_id: response.payload.sub,
    };

    let user = await User.query(txn).findOne({ email: userObj.email });
    if (!user) {
      user = await User.query(txn).insert(userObj);
    }
    return user;
  }

  createToken = (user) => {
    const JWTtoken = JWT.sign({ id: user.id, email: user.email }, CONFIG.auth.jwt.secret, {
      algorithm: 'HS256',
      expiresIn: CONFIG.auth.jwt.expiresIn,
    });
    return JWTtoken;
  };
};
