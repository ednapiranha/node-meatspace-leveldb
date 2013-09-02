'use strict';

process.env.NODE_ENV = 'test';

var should = require('should');
var nock = require('nock');
var child = require('child_process');
var Meatspace = require('../index');

var meat = new Meatspace({
  fullName: 'test name',
  username: 'test',
  postUrl: 'http://test.com/recent.json',
  db: './test/db'
});
var id;
var secId;

var getObjSize = function(obj) {
  var size = 0;

  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      size ++;
    }
  }

  return size;
};

var message = {
  content: {
    message: 'some message',
    urls: [
      {
        title: 'some url',
        url: 'http://some.url.com'
      }
    ]
  },
  meta: {
    originUrl: 'http://test.com/recent.json',
    location: '37.3882807, -122.0828559',
    isPrivate: false,
    isShared: false
  },
  shares: []
};

var externalMessage = {
  content: {
    message: 'some other message'
  },
  meta: {
    originUrl: 'http://some.other.url.com/recent.json',
    location: '37.3882807, -122.0828559',
    isPrivate: false,
    isShared: false
  },
  shares: []
};

describe('meatspace', function () {
  after(function () {
    child.exec('rm -rf ./test/db');
  });

  describe('.create',  function () {
    it('creates an invalid message', function (done) {
      meat.fullName = null;
      meat.create(message, function (err, m) {
        should.exist(err);
        done();
      });
    });

    it('creates a valid public message', function (done) {
      meat.fullName = 'test name';
      meat.username = 'test2';
      meat.postUrl = 'http://url.to.blog.com/recent.json';
      meat.create(message, function (err, m) {
        should.exist(m);
        id = m.id;
        m.content.should.equal(message.content);
        m.username.should.equal(meat.username);
        m.fullName.should.equal(meat.fullName);
        m.meta.should.equal(message.meta);
        done();
      });
    });

    it('creates a valid private message', function (done) {
      message.meta.isPrivate = true;
      meat.create(message, function (err, m) {
        should.exist(m);
        secId = m.id;
        m.meta.isPrivate.should.equal(message.meta.isPrivate);
        done();
      });
    });
  });

  describe('.get', function () {
    it('gets a message', function (done) {
      meat.get(id, function (err, m) {
        should.exist(m);
        done();
      });
    });

    it('does not get a message', function (done) {
      meat.get(1111, function (err, m) {
        should.exist(err);
        done();
      });
    });
  });

  describe('.update', function () {
    it('updates a message', function (done) {
      meat.get(id, function (err, m) {
        m.content.message = 'new message';
        m.meta.isPrivate = true;

        setTimeout(function () {
          meat.update(m, function (err, mt) {
            mt.content.message.should.equal(m.content.message);
            mt.meta.isPrivate.should.equal(true);
            mt.content.updated.should.not.equal(mt.content.created);
            done();
          });
        }, 1500);
      });
    });
  });

  describe('.getAll', function () {
    it('get all messages', function (done) {
      meat.getAll(0, function (err, mArr) {
        should.exist(mArr);
        mArr.length.should.equal(2);
        done();
      });
    });
  });

  describe('.share', function () {
    it('shares an external message', function (done) {
      meat.share(externalMessage, meat.postUrl, function (err, m) {
        should.exist(m);
        m.shares.length.should.equal(1);
        m.shares[0].should.equal(meat.postUrl);
        m.meta.isShared.should.equal(true);
        m.meta.originUrl.should.equal(externalMessage.meta.originUrl);
        done();
      });
    });

    it('does not share a post that has already been shared', function (done) {
      meat.share(externalMessage, meat.postUrl, function (err, m) {
        should.exist(err);
        done();
      });
    });
  });

  describe('.subscribe', function () {
    it('subscribes to a url', function (done) {
      var subUrl = 'http://some.other.url/recent.json';
      meat.subscribe(subUrl, function (err, url) {
        meat.getSubscriptions(function (err, s) {
          should.exist(s);
          s.length.should.equal(1);
          s[0].should.equal(subUrl);
          done();
        });
      });
    });
  });

  describe('.getSubscriptionRecent', function () {
    it('gets all recent messages from a subscription', function (done) {
      var subUrl = 'http://some.other.url/recent.json';
      var scope = nock('http://some.other.url').get('/recent.json')
                                               .reply(200, { posts: [externalMessage] });
      meat.getSubscriptionRecent(subUrl, function (err, m) {
        should.not.exist(err);
        done();
      });
    });

    it('does not get recent messages from an invalid JSON response', function (done) {
      var subUrl = 'http://some.other.url/recent.json';
      var scope = nock('http://some.other.url').get('/recent.json')
                                               .reply(200, 'uh oh');
      meat.getSubscriptionRecent(subUrl, function (err, m) {
        should.exist(err);
        done();
      });
    });

    it('does not get recent messages from an unsubscribed url', function (done) {
      var subUrl = 'http://some.other.url.unsub/recent.json';
      meat.getSubscriptionRecent(subUrl, function (err, m) {
        should.exist(err);
        done();
      });
    });
  });

  describe('.unsubscribe', function () {
    it('unsubscribes to a url', function (done) {
      var subUrl = 'http://some.other.url/recent.json';
      meat.unsubscribe(subUrl, function (err) {
        meat.getSubscriptions(function (err, s) {
          should.exist(s);
          s.length.should.equal(0);
          done();
        });
      });
    });
  });

  describe('.shareRecent', function () {
    it('get all recent public messages', function (done) {
      meat.shareRecent(0, function (err, mArr) {
        should.exist(mArr);
        mArr.length.should.equal(2);
        done();
      });
    });
  });

  describe('.shareOne', function () {
    it('get a single valid public message', function (done) {
      message.meta.isPrivate = false;
      meat.create(message, function (err, m) {
        meat.shareOne(m.id, function (err, m) {
          should.exist(m);
          m.meta.isPrivate.should.equal(false);
          done();
        });
      });
    });

    it('get a single invalid public message', function (done) {
      meat.shareOne(secId, function (err, m) {
        should.exist(err);
        done();
      });
    });
  });

  describe('.del', function () {
    it('deletes a message', function (done) {
      meat.create(message, function (err, m) {
        id = m.id; // new id 6
        meat.del(id, function (err, status) {
          meat.get(id, function (err, msg) {
            should.not.exist(msg);
            done();
          });
        });
      });
    });
  });
});
