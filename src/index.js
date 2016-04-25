import _ from 'lodash';
import socketio from 'socket.io';
const io = socketio();
import protocol from '../protocol';
import crypto from 'crypto';

/**
 * entity
 * - id
 * - imgHash
 * - pos.x
 * - pos.y
 * - selectedClientId
 */
const entities = {};
const players = {};

let nextEntityId = 0;
let nextEntityDepth = 0;

io.on('connection', socket => {
  const remoteAddress = socket.request.connection.remoteAddress;
  console.log(`Client ${remoteAddress} connected. (${socket.id})`);

  socket.on(protocol.requests.HANDSHAKE, data => {
    const id = crypto
      .createHash('sha1')
      .update(data.authToken)
      .digest('base64');

    socket.emit(protocol.replies.HANDSHAKE_REPLY, {id});
    socket.emit(protocol.events.PLAYER_JOIN, _.values(players));
    socket.emit(protocol.events.ENTITY_CREATE, _.values(entities));

    players[getClientId(socket)] = {
      id: id,
      color: nextPlayerColor(),
    };

    socket.join('game');
    io.to('game').emit(protocol.events.PLAYER_JOIN, [players[getClientId(socket)]]);
  });
  
  onRequest(socket, protocol.requests.ENTITY_CREATE_REQUEST, (entityArr, player) => {
    const createList = [];
    entityArr.forEach(entity => {
      const id = ++nextEntityId;
      entity.id = id;
      entity.depth = ++nextEntityDepth;
      entities[id] = entity;
      createList.push(entity);
    });

    if (createList.length !== 0) {
      io.to('game').emit(protocol.events.ENTITY_CREATE, createList);
    }
  });

  onRequest(socket, protocol.requests.ENTITY_DELETE_REQUEST, (entityArr, player) => {
    const deleteList = [];
    entityArr.forEach(entity => {
      const id = entity.id;
      if (entities[id]) {
        delete entities[id];
        deleteList.push({id});
      }
    });

    if (deleteList.length !== 0) {
      io.to('game').emit(protocol.events.ENTITY_DELETE, deleteList);
    }
  });

  onRequest(socket, protocol.requests.ENTITY_SELECT_REQUEST, (entityArr, player) => {
    const updateList = [];
    _.forOwn(entities, entity => {
      if (entity.selectedClientId === null || 
            entity.selectedClientId === player.id) {
        const old = entity.selectedClientId;
        entity.selectedClientId = _.some(entityArr, {id: entity.id}) ? player.id : null;
        
        if (entity.selectedClientId) {
          entity.depth = ++nextEntityDepth;
        }

        if (old !== entity.selectedClientId) {
          updateList.push({
            id: entity.id,
            selectedClientId: entity.selectedClientId,
            depth: entity.depth,
          });
        }
      }
    });

    if (updateList.length !== 0) {
      io.to('game').emit(protocol.events.ENTITY_SELECT, updateList);
    }
  });

  onRequest(socket, protocol.requests.ENTITY_MOVE_REQUEST, (entityArr, player) => {
    const moveList = [];
    entityArr.forEach(entity => {
      let ent = entities[entity.id];
      if (ent.selectedClientId === player.id) {
        ent.pos = entity.pos;
        ent.depth = ++nextEntityDepth;
        moveList.push({
          id: ent.id,
          pos: ent.pos,
          depth: ent.depth,
        });
      }
    });

    if (moveList.length !== 0) {
      io.to('game').emit(protocol.events.ENTITY_MOVE, moveList);
    }
  });

  onRequest(socket, protocol.requests.PLAYER_UPDATE_REQUEST, (update, player) => {
    player.name = update.name;
    io.to('game').emit(protocol.events.PLAYER_UPDATE, {
      id: player.id,
      name: player.name,
    });
  });

  socket.on('disconnect', () => {
    console.log(`Client ${remoteAddress} disconnected. (${socket.id})`);
    if (players[getClientId(socket)]) {
      io.to('game').emit(protocol.events.PLAYER_LEAVE,
                                [{id: players[getClientId(socket)].id}]);
      delete players[getClientId(socket)];
    }
  });
});

io.listen(8000);

function getClientId(socket) {
  return socket.id.substr(2);
}

function onRequest(socket, type, callback) {
  socket.on(type, data => {
    const player = players[getClientId(socket)];
    if (player) {
      callback(data, player);
    }
  });
}

function nextPlayerColor() {
  for (let i = 0;; ++i) {
    if (!_.some(players, {color: i})) {
      return i;
    }
  }
}

/**
 * @param {Type}
 * @return {Type}
 */
export default function () {
  return true
}
