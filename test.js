import assume from 'assume';
import Bungo from './';

describe('Bungie', function () {
  let bungo;

  beforeEach(function () {
    bungo = new Bungo({});
  });

  it('merges the default params', function () {
    assume(bungo.config).deep.equals(Bungo.defaults);
  });

  it('overrides given defaults with custom config', function () {
    assume(bungo.config.url).equals(Bungo.defaults.url);
    bungo = new Bungo({'url': 'google.com' });
    assume(bungo.config.url).does.not.equal(Bungo.defaults.url);
  });

  describe('#expired', function () {
    it('returns true if its no object or has no value or no epoch', function () {
      assume(bungo.expired(null)).is.true();
      assume(bungo.expired(true)).is.true();
      assume(bungo.expired({})).is.true();
      assume(bungo.expired('string')).is.true();
      assume(bungo.expired({ epoch: 1339 })).is.true();
      assume(bungo.expired({ value: '2442' })).is.true();
      assume(bungo.expired({ value: 313, epoch: 1339 })).is.true();
    });

    it('returns false when a token is not expired', function () {
      const token = {
        value: 'token',
        epoch: Date.now(),
        expires: 90000
      };

      assume(bungo.expired(token)).is.false();
    });
  });
});
