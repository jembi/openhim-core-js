import bcrypt from 'bcryptjs';

export const validatePassword = function (passport, password, next) {
  bcrypt.compare(password, passport.password, next);
};

export async function hashPassword(password) {
  var salt = 8;

  if (password) {
    return new Promise((resolve, reject) => {
      bcrypt.hash(password, salt, function (err, hash) {
        if (err) {
          console.error(err);
          reject(err);
        }
        resolve(hash);
      });
    });
  } else {
    throw new Error("Password wasn't provided");
  }
}
