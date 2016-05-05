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
const sockets = {};

let nextEntityId = 0;
let nextEntityDepth = 0;

io.on('connection', socket => {
  const socketId = getSocketId(socket);
  const remoteAddress = socket.request.connection.remoteAddress;
  console.log(`Client ${remoteAddress} connected. (${socketId})`);

  socket.on(protocol.requests.HANDSHAKE, data => {
    const id = crypto
      .createHash('sha1')
      .update(data.authToken)
      .digest('base64');

    socket.emit(protocol.replies.HANDSHAKE_REPLY, {id});
    socket.emit(protocol.events.PLAYER_JOIN, _.values(players));
    socket.emit(protocol.events.ENTITY_CREATE, _.values(entities));
    socket.join('game');
    sockets[socketId] = id;

    if (!players[id]) {
      players[id] = {
        id,
        color: nextPlayerColor(),
      };

      io.to('game').emit(protocol.events.PLAYER_JOIN, [players[id]]);
    }
  });

  onRequest(socket, protocol.requests.ENTITY_CREATE_REQUEST, (entityArr, player) => {
    const createList = [];
    entityArr.forEach(entity => {
      const id = ++nextEntityId;
      entity.id = id;
      entity.selectedClientId = null;
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
    let updateList = {};

    // Deselect entities previously selected by the player
    _(entities)
    .values()
    .filter(x => x.selectedClientId === player.id)
    .forEach(entity => {
      entity.selectedClientId = null;
      updateList[entity.id] = _.pick(entity, ['id', 'selectedClientId', 'depth']);
    });

    // Make the new selection
    _(entityArr)
    .map(x => entities[x.id])
    .filter(x => x.selectedClientId === null)
    .forEach(entity => {
      entity.selectedClientId = player.id;
      entity.depth = ++nextEntityDepth;
      updateList[entity.id] = _.pick(entity, ['id', 'selectedClientId', 'depth']);
    });

    updateList = _.values(updateList);
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

  onRequest(socket, protocol.requests.CHAT_MESSAGE_REQUEST, (message, player) => {
    io.to('game').emit(protocol.events.CHAT_MESSAGE, {
      content: message.content,
      fromId: player.id,
      time: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    const socketId = getSocketId(socket);
    const playerId = sockets[socketId];

    console.log(`Client ${remoteAddress} disconnected. (${socketId})`);

    if (playerId) {
      delete sockets[socketId];

      if (!_.some(sockets, x => x === playerId)) {
        io.to('game').emit(protocol.events.PLAYER_LEAVE, [{id: playerId}]);
        delete players[playerId];
      }
    }
  });
});

io.listen(8000);

function getSocketId(socket) {
  return socket.id.substr(2);
}

function onRequest(socket, type, callback) {
  socket.on(type, data => {
    const playerId = sockets[getSocketId(socket)];
    const player = players[playerId];

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
