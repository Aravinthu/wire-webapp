/*
 * Wire
 * Copyright (C) 2017 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

// grunt test_init && grunt test_run:conversation/ConversationService

'use strict';

describe('ConversationService', function() {
  let conversation_mapper = null;
  let conversation_service = null;
  let server = null;
  let storage_service = null;
  const test_factory = new TestFactory();

  beforeAll(function(done) {
    test_factory.exposeStorageActors()
      .then(function(storage_repository) {
        const {client} = test_factory;
        ({storage_service} = storage_repository);
        conversation_service = new z.conversation.ConversationService(client, storage_service);
        conversation_mapper = new z.conversation.ConversationMapper();
        server = sinon.fakeServer.create();
        done();
      })
      .catch(done.fail);
  });

  afterEach(function() {
    storage_service.clear_all_stores();
    server.restore();
  });

  describe('load_preceding_events_from_db', function() {
    const conversation_id = '35a9a89d-70dc-4d9e-88a2-4d8758458a6a';

    // @formatter:off
    /* eslint-disable comma-spacing, key-spacing, sort-keys, quotes */
    const messages = [
      {"conversation":"35a9a89d-70dc-4d9e-88a2-4d8758458a6a","id":"68a28ab1-d7f8-4014-8b52-5e99a05ea3b1","from":"8b497692-7a38-4a5d-8287-e3d1006577d6","time":"2016-08-04T13:27:55.182Z","data":{"content":"First message","nonce":"68a28ab1-d7f8-4014-8b52-5e99a05ea3b1","previews":[]},"type":"conversation.message-add"},
      {"conversation":"35a9a89d-70dc-4d9e-88a2-4d8758458a6a","id":"4af67f76-09f9-4831-b3a4-9df877b8c29a","from":"8b497692-7a38-4a5d-8287-e3d1006577d6","time":"2016-08-04T13:27:58.993Z","data":{"content":"Second message","nonce":"4af67f76-09f9-4831-b3a4-9df877b8c29a","previews":[]},"type":"conversation.message-add"},
    ];
    /* eslint-enable comma-spacing, key-spacing, sort-keys, quotes */
    // @formatter:on

    beforeEach(function(done) {
      Promise.all(messages.map((message) => storage_service.save(z.storage.StorageService.OBJECT_STORE.EVENTS, undefined, message)))
        .then(done)
        .catch(done.fail);
    });

    it('returns mapped message_et if event with id is found', function(done) {
      conversation_service.load_event_from_db(conversation_id, '4af67f76-09f9-4831-b3a4-9df877b8c29a')
        .then(function(message_et) {
          expect(message_et).toEqual(messages[1]);
          done();
        })
        .catch(done.fail);
    });

    it('returns undefined if no event with id is found', function(done) {
      conversation_service.load_event_from_db(conversation_id, z.util.create_random_uuid())
        .then(function(message_et) {
          expect(message_et).not.toBeDefined();
          done();
        })
        .catch(done.fail);
    });
  });

  describe('update_message_in_db', function() {
    // @formatter:off
    /* eslint-disable comma-spacing, key-spacing, sort-keys, quotes */
    const event = {"conversation":"35a9a89d-70dc-4d9e-88a2-4d8758458a6a","id":"4af67f76-09f9-4831-b3a4-9df877b8c29a","from":"8b497692-7a38-4a5d-8287-e3d1006577d6","time":"2016-08-04T13:27:58.993Z","data":{"content":"Second message","nonce":"4af67f76-09f9-4831-b3a4-9df877b8c29a","previews":[]},"type":"conversation.message-add"};
    /* eslint-enable comma-spacing, key-spacing, sort-keys, quotes */
    // @formatter:on

    it('updated event in the database', function(done) {
      event.time = new Date().toISOString();
      event.primary_key = 1337;
      conversation_service.update_message_in_db(event, {time: event.time})
        .then(done)
        .catch(done.fail);
    });

    it('fails if changes are not specified', function(done) {
      conversation_service.update_message_in_db(event, undefined)
        .then(done.fail)
        .catch(function(error) {
          expect(error).toEqual(jasmine.any(z.conversation.ConversationError));
          expect(error.type).toBe(z.conversation.ConversationError.TYPE.NO_CHANGES);
          done();
        });
    });
  });

  describe('load_preceding_events_from_db', function() {
    const conversation_id = '35a9a89d-70dc-4d9e-88a2-4d8758458a6a';
    let messages = undefined;

    beforeEach(function(done) {
      const timestamp = 1479903546799;
      messages = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function(index) {
        return {
          'conversation': conversation_id,
          'time': new Date(timestamp + index).toISOString(),
        };
      });

      Promise.all(messages.map((message) => storage_service.save(z.storage.StorageService.OBJECT_STORE.EVENTS, undefined, message)))
        .then(done)
        .catch(done.fail);
    });

    it('doesn\'t load events for invalid conversation id', function(done) {
      conversation_service.load_preceding_events_from_db('invalid_id', new Date(30), new Date(1479903546808))
        .then(function(events) {
          expect(events.length).toBe(0);
          done();
        });
    });

    it('loads all events', function(done) {
      conversation_service.load_preceding_events_from_db(conversation_id)
        .then(function(events) {
          expect(events.length).toBe(10);
          expect(events[0].time).toBe('2016-11-23T12:19:06.808Z');
          expect(events[9].time).toBe('2016-11-23T12:19:06.799Z');
          done();
        });
    });

    it('loads all events with limit', function(done) {
      conversation_service.load_preceding_events_from_db(conversation_id, undefined, undefined, 5)
        .then(function(events) {
          expect(events.length).toBe(5);
          expect(events[0].time).toBe('2016-11-23T12:19:06.808Z');
          expect(events[4].time).toBe('2016-11-23T12:19:06.804Z');
          done();
        });
    });

    it('loads events with lower bound', function(done) {
      conversation_service.load_preceding_events_from_db(conversation_id, new Date(1479903546805))
        .then(function(events) {
          expect(events.length).toBe(4);
          expect(events[0].time).toBe('2016-11-23T12:19:06.808Z');
          expect(events[1].time).toBe('2016-11-23T12:19:06.807Z');
          expect(events[2].time).toBe('2016-11-23T12:19:06.806Z');
          expect(events[3].time).toBe('2016-11-23T12:19:06.805Z');
          done();
        });
    });

    it('loads events with upper bound', function(done) {
      conversation_service.load_preceding_events_from_db(conversation_id, undefined, new Date(1479903546803))
        .then(function(events) {
          expect(events.length).toBe(4);
          expect(events[0].time).toBe('2016-11-23T12:19:06.802Z');
          expect(events[1].time).toBe('2016-11-23T12:19:06.801Z');
          expect(events[2].time).toBe('2016-11-23T12:19:06.800Z');
          expect(events[3].time).toBe('2016-11-23T12:19:06.799Z');
          done();
        });
    });

    it('loads events with upper and lower bound', function(done) {
      conversation_service.load_preceding_events_from_db(conversation_id, new Date(1479903546806), new Date(1479903546807))
        .then(function(events) {
          expect(events.length).toBe(1);
          expect(events[0].time).toBe('2016-11-23T12:19:06.806Z');
          done();
        });
    });

    it('loads events with upper and lower bound and a fetch limit', function(done) {
      conversation_service.load_preceding_events_from_db(conversation_id, new Date(1479903546800), new Date(1479903546807), 2)
        .then(function(events) {
          expect(events.length).toBe(2);
          expect(events[0].time).toBe('2016-11-23T12:19:06.806Z');
          expect(events[1].time).toBe('2016-11-23T12:19:06.805Z');
          done();
        });
    });
  });

  describe('save_conversation_in_db', function() {
    it('saves a conversation', function(done) {
      // @formatter:off
      /* eslint-disable comma-spacing, key-spacing, sort-keys, quotes */
      const conversation_payload = {"access":["private"],"creator":"0410795a-58dc-40d8-b216-cbc2360be21a","members":{"self":{"hidden_ref":null,"status":0,"last_read":"24fe.800122000b16c279","muted_time":null,"otr_muted_ref":null,"muted":false,"status_time":"2014-12-03T18:39:12.319Z","hidden":false,"status_ref":"0.0","id":"532af01e-1e24-4366-aacf-33b67d4ee376","otr_archived":false,"cleared":null,"otr_muted":false,"otr_archived_ref":"2016-07-25T11:30:07.883Z","archived":null},"others":[{"status":0,"id":"0410795a-58dc-40d8-b216-cbc2360be21a"}]},"name":"Michael","id":"573b6978-7700-443e-9ce5-ff78b35ac590","type":2,"last_event_time":"2016-06-21T22:53:41.778Z","last_event":"24fe.800122000b16c279"};
      /* eslint-enable comma-spacing, key-spacing, sort-keys, quotes */
      // @formatter:on
      const [conversation_et] = conversation_mapper.map_conversations([conversation_payload]);

      conversation_service.save_conversation_state_in_db(conversation_et)
        .then(function(conversation_record) {
          expect(conversation_record.name()).toBe(conversation_payload.name);
          done();
        });
    });
  });

  describe('load_subsequent_events_from_db', function() {
    const conversation_id = '35a9a89d-70dc-4d9e-88a2-4d8758458a6a';
    const sender_id = '8b497692-7a38-4a5d-8287-e3d1006577d6';
    let events = undefined;

    beforeEach(function(done) {
      const timestamp = new Date('2016-11-23T12:19:06.808Z').getTime();
      events = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function(index) {
        return {
          'conversation': conversation_id,
          'from': sender_id,
          'time': new Date(timestamp + index).toISOString(),
        };
      });

      Promise.all(events.map((event) => storage_service.save(z.storage.StorageService.OBJECT_STORE.EVENTS, undefined, event)))
        .then(done)
        .catch(done.fail);
    });

    it('loads all events', function(done) {
      conversation_service.load_subsequent_events_from_db(conversation_id, new Date('2016-11-23T12:19:06.808Z'), 2)
        .then(function(_events) {
          expect(_events.length).toBe(2);
          expect(_events[0].time).toBe('2016-11-23T12:19:06.808Z');
          expect(_events[1].time).toBe('2016-11-23T12:19:06.809Z');
          done();
        });
    });

    it('loads all events when include message is false', function(done) {
      conversation_service.load_subsequent_events_from_db(conversation_id, new Date('2016-11-23T12:19:06.808Z'), 2, false)
        .then(function(_events) {
          expect(_events.length).toBe(2);
          expect(_events[0].time).toBe('2016-11-23T12:19:06.809Z');
          expect(_events[1].time).toBe('2016-11-23T12:19:06.810Z');
          done();
        });
    });
  });

  describe('delete_message_with_key_from_db', function() {
    const conversation_id = '35a9a89d-70dc-4d9e-88a2-4d8758458a6a';
    let primary_keys = undefined;

    // @formatter:off
    /* eslint-disable comma-spacing, key-spacing, sort-keys, quotes */
    const messages = [
      {"conversation":"35a9a89d-70dc-4d9e-88a2-4d8758458a6a","id":"68a28ab1-d7f8-4014-8b52-5e99a05ea3b1","from":"8b497692-7a38-4a5d-8287-e3d1006577d6","time":"2016-08-04T13:27:55.182Z","data":{"content":"First message","nonce":"68a28ab1-d7f8-4014-8b52-5e99a05ea3b1","previews":[]},"type":"conversation.message-add"},
      {"conversation":"35a9a89d-70dc-4d9e-88a2-4d8758458a6a","id":"4af67f76-09f9-4831-b3a4-9df877b8c29a","from":"8b497692-7a38-4a5d-8287-e3d1006577d6","time":"2016-08-04T13:27:58.993Z","data":{"content":"Second message","nonce":"4af67f76-09f9-4831-b3a4-9df877b8c29a","previews":[]},"type":"conversation.message-add"},
      {"conversation":"35a9a89d-70dc-4d9e-88a2-4d8758458a6a","id":"4af67f76-09f9-4831-b3a4-9df877b8c29a","from":"8b497692-7a38-4a5d-8287-e3d1006577d6","time":"2016-08-04T13:27:58.993Z","data":{"content":"Second message (Duplicate)","nonce":"4af67f76-09f9-4831-b3a4-9df877b8c29a","previews":[]},"type":"conversation.message-add"},
    ];
    /* eslint-enable comma-spacing, key-spacing, sort-keys, quotes */
    // @formatter:on

    beforeEach(function(done) {
      Promise.all(messages.map((message) => storage_service.save(z.storage.StorageService.OBJECT_STORE.EVENTS, undefined, message)))
        .then(function(ids) {
          primary_keys = ids;
          done();
        })
        .catch(done.fail);
    });

    it('deletes message with the given key', function(done) {
      conversation_service.delete_message_with_key_from_db(primary_keys[1])
        .then(() => conversation_service.load_preceding_events_from_db(conversation_id))
        .then(function(events) {
          expect(events.length).toBe(2);
          events.forEach((event) => expect(event.primary_key).not.toBe(primary_keys[1]));
          done();
        })
        .catch(done.fail);
    });

    it('does not delete the event if key is wrong', function(done) {
      conversation_service.delete_message_with_key_from_db('wrongKey')
        .then(() => conversation_service.load_preceding_events_from_db(conversation_id))
        .then(function(events) {
          expect(events.length).toBe(3);
          done();
        })
        .catch(done.fail);
    });
  });

  describe('load_events_with_category_from_db', function() {
    let events = undefined;

    beforeEach(function() {
      // @formatter:off
      /* eslint-disable comma-spacing, key-spacing, sort-keys, quotes */
      events = [
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c0","id":"b6498d81-92e8-4da7-afd2-054239595da7","from":"9b47476f-974d-481c-af64-13f82ed98a5f","time":"2017-01-09T13:11:15.632Z","status":2,"data":{"content":"test","nonce":"b6498d81-92e8-4da7-afd2-054239595da7","previews":[]},"type":"conversation.message-add","category": 16},
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c0","id":"da7930dd-4c30-4378-846d-b29e1452bdfb","from":"9b47476f-974d-481c-af64-13f82ed98a5f","time":"2017-01-09T13:37:31.941Z","status":1,"data":{"content_length":47527,"content_type":"image/jpeg","id":"b77e8639-a32d-4ba7-88b9-7a0ae461e90d","info":{"tag":"medium","width":1448,"height":905,"nonce":"b77e8639-a32d-4ba7-88b9-7a0ae461e90d"},"otr_key":{},"sha256":{}},"type":"conversation.asset-add","category": 128},
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c0","id":"da7930dd-4c30-4378-846d-b29e1452bdfa","from":"9b47476f-974d-481c-af64-13f82ed98a5f","time":"2017-01-09T13:47:31.941Z","status":1,"data":{"content_length":47527,"content_type":"image/jpeg","id":"b77e8639-a32d-4ba7-88b9-7a0ae461e90d","info":{"tag":"medium","width":1448,"height":905,"nonce":"b77e8639-a32d-4ba7-88b9-7a0ae461e90d"},"otr_key":{},"sha256":{}},"type":"conversation.asset-add","category": 128},
      ];
      /* eslint-enable comma-spacing, key-spacing, sort-keys, quotes */
      // @formatter:on
    });

    it('should return no entry matches the given category', function(done) {
      Promise.all(events.slice(0, 1).map((event) => storage_service.save(z.storage.StorageService.OBJECT_STORE.EVENTS, undefined, event)))
        .then(() => conversation_service.load_events_with_category_from_db(events[0].conversation, z.message.MessageCategory.IMAGE))
        .then(function(result) {
          expect(result.length).toBe(0);
          done();
        })
        .catch(done.fail);
    });

    it('should get images in the correct order', function(done) {
      Promise.all(events.map((event) => storage_service.save(z.storage.StorageService.OBJECT_STORE.EVENTS, undefined, event)))
        .then(() => conversation_service.load_events_with_category_from_db(events[0].conversation, z.message.MessageCategory.IMAGE))
        .then(function(result) {
          expect(result.length).toBe(2);
          expect(result[0].id).toBe(events[1].id);
          expect(result[1].id).toBe(events[2].id);
          done();
        })
        .catch(done.fail);
    });
  });

  describe('search_in_conversation', function() {
    let events = undefined;

    beforeEach(function() {
      // @formatter:off
      /* eslint-disable comma-spacing, key-spacing, sort-keys, quotes */
      events = [
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c0","id":"f7adaa16-38f5-483e-b621-72ff1dbd2275","from":"5598f954-674f-4a34-ad47-9e5ee8f00bcd","time":"2017-01-09T13:11:15.051Z","data":{"content":"https://wire.com","nonce":"f7adaa16-38f5-483e-b621-72ff1dbd2275","previews":[]},"type":"conversation.message-add","category": 16},
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c0","id":"f7adaa16-38f5-483e-b621-72ff1dbd2276","from":"5598f954-674f-4a34-ad47-9e5ee8f00bce","time":"2017-01-09T13:11:15.052Z","data":{"content":"https://wire.com","nonce":"f7adaa16-38f5-483e-b621-72ff1dbd2276","previews":["CjZodHRwczovL3dpcmUuY29tLz81ZDczNDQ0OC00NDZiLTRmYTItYjMwMy1lYTJhNzhiY2NhMDgQABpWCjZodHRwczovL3dpcmUuY29tLz81ZDczNDQ0OC00NDZiLTRmYTItYjMwMy1lYTJhNzhiY2NhMDgSHFdpcmUgwrcgTW9kZXJuIGNvbW11bmljYXRpb24="]},"type":"conversation.message-add","category": 112},
      ];
      /* eslint-enable comma-spacing, key-spacing, sort-keys, quotes */
      // @formatter:on
    });

    it('should find query in text message', function(done) {
      Promise.all(events.slice(0, 1).map((event) => storage_service.save(z.storage.StorageService.OBJECT_STORE.EVENTS, undefined, event)))
        .then(() => conversation_service.search_in_conversation(events[0].conversation, 'https://wire.com'))
        .then(function(result) {
          expect(result.length).toBe(1);
          expect(result[0].id).toBe('f7adaa16-38f5-483e-b621-72ff1dbd2275');
          done();
        })
        .catch(done.fail);
    });

    it('should find query in text message with link preview', function(done) {
      Promise.all(events.map((event) => storage_service.save(z.storage.StorageService.OBJECT_STORE.EVENTS, undefined, event)))
        .then(() => conversation_service.search_in_conversation(events[0].conversation, 'https://wire.com'))
        .then(function(result) {
          expect(result.length).toBe(2);
          expect(result[0].id).toBe('f7adaa16-38f5-483e-b621-72ff1dbd2275');
          expect(result[1].id).toBe('f7adaa16-38f5-483e-b621-72ff1dbd2276');
          done();
        })
        .catch(done.fail);
    });
  });

  describe('search_in_conversation', function() {
    let events = undefined;

    beforeEach(function() {
      // @formatter:off
      /* eslint-disable comma-spacing, key-spacing, sort-keys, quotes */
      events = [
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c0","id":"f7adaa16-38f5-483e-b621-72ff1dbd2275","from":"5598f954-674f-4a34-ad47-9e5ee8f00bcd","time":`${new Date().toISOString()}`,"data":{"content":"hello","nonce":"f7adaa16-38f5-483e-b621-72ff1dbd2275","previews":[]},"type":"conversation.message-add","category":16},
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c0","id":"f7adaa16-38f5-483e-b621-72ff1dbd2275","from":"5598f954-674f-4a34-ad47-9e5ee8f00bcd","time":`${new Date(Date.now() - 1).toISOString()}`,"data":{"content":"hello","nonce":"f7adaa16-38f5-483e-b621-72ff1dbd2275","previews":[]},"type":"conversation.message-add","category":16},
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c1","id":"f7adaa16-38f5-483e-b621-72ff1dbd2275","from":"5598f954-674f-4a34-ad47-9e5ee8f00bcd","time":`${new Date(Date.now() - 2).toISOString()}`,"data":{"content":"hello","nonce":"f7adaa16-38f5-483e-b621-72ff1dbd2275","previews":[]},"type":"conversation.message-add","category":16},
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c1","id":"f7adaa16-38f5-483e-b621-72ff1dbd2275","from":"5598f954-674f-4a34-ad47-9e5ee8f00bcd","time":`${new Date(Date.now() - 3).toISOString()}`,"data":{"content":"hello","nonce":"f7adaa16-38f5-483e-b621-72ff1dbd2275","previews":[]},"type":"conversation.message-add","category":16},
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c1","id":"f7adaa16-38f5-483e-b621-72ff1dbd2275","from":"5598f954-674f-4a34-ad47-9e5ee8f00bcd","time":`${new Date(Date.now() - 4).toISOString()}`,"data":{"content":"hello","nonce":"f7adaa16-38f5-483e-b621-72ff1dbd2275","previews":[]},"type":"conversation.message-add","category":16},
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c2","id":"f7adaa16-38f5-483e-b621-72ff1dbd2275","from":"5598f954-674f-4a34-ad47-9e5ee8f00bcd","time":`${new Date(Date.now() - 5).toISOString()}`,"data":{"content":"hello","nonce":"f7adaa16-38f5-483e-b621-72ff1dbd2275","previews":[]},"type":"conversation.message-add","category":16},
        {"conversation":"34e7f58e-b834-4d84-b628-b89b295d46c3","id":"f7adaa16-38f5-483e-b621-72ff1dbd2275","from":"5598f954-674f-4a34-ad47-9e5ee8f00bcd","time":"2016-01-09T13:11:15.051Z","data":{"content":"hello","nonce":"f7adaa16-38f5-483e-b621-72ff1dbd2275","previews":[]},"type":"conversation.message-add","category":16},
      ];
      /* eslint-enable comma-spacing, key-spacing, sort-keys, quotes */
      // @formatter:on
    });

    it('should return conversation ids sorted by number of messages', function(done) {
      Promise.all(events.map((event) => storage_service.save(z.storage.StorageService.OBJECT_STORE.EVENTS, undefined, event)))
        .then(() => conversation_service.get_active_conversations_from_db())
        .then(function(result) {
          expect(result.length).toBe(3);
          expect(result[0]).toBe('34e7f58e-b834-4d84-b628-b89b295d46c1');
          expect(result[1]).toBe('34e7f58e-b834-4d84-b628-b89b295d46c0');
          expect(result[2]).toBe('34e7f58e-b834-4d84-b628-b89b295d46c2');
          done();
        })
        .catch(done.fail);
    });
  });
});
