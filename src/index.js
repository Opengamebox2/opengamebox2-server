import socketio from 'socket.io';
const io = socketio();
import {types, channels} from '../protocol/protocol';
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

  socket.on(types.HANDSHAKE, data => {
    const id = crypto
      .createHash('sha1')
      .update(data.authToken)
      .digest('base64');

    socket.emit(types.HANDSHAKE_REPLY, {id});
    socket.emit(types.PLAYER_JOIN, objectToList(players));
    socket.emit(types.ENTITY_CREATE, objectToList(entities));

    players[getClientId(socket)] = {
      id: id,
      color: nextPlayerColor(),
    };

    socket.join(channels.GAME);
    io.to(channels.GAME).emit(types.PLAYER_JOIN, [players[getClientId(socket)]]);
  });
  
  onRequest(socket, types.ENTITY_CREATE_REQUEST, (entityArr, player) => {
    const createList = [];
    entityArr.forEach(entity => {
      const id = ++nextEntityId;
      entity.id = id;
      entity.depth = ++nextEntityDepth;
      entities[id] = entity;
      createList.push(entity);
    });

    if (createList.length !== 0) {
      io.to(channels.GAME).emit(types.ENTITY_CREATE, createList);
    }
  });

  onRequest(socket, types.ENTITY_DELETE_REQUEST, (entityArr, player) => {
    const deleteList = [];
    entityArr.forEach(entity => {
      const id = entity.id;
      if (entities[id]) {
        delete entities[id];
        deleteList.push({id});
      }
    });

    if (deleteList.length !== 0) {
      io.to(channels.GAME).emit(types.ENTITY_DELETE, deleteList);
    }
  });

  onRequest(socket, types.ENTITY_SELECT_REQUEST, (entityArr, player) => {
    const updateList = [];
    Object.keys(entities).forEach(key => {
      let entity = entities[key];
      if (entity.selectedClientId === null || 
            entity.selectedClientId === player.id) {
        const old = entity.selectedClientId;
        entity.selectedClientId = entityArr.find(ent => entity.id === ent.id) ? player.id : null;
        
        if (entity.selectedClientId) {
          entity.depth = ++nextEntityDepth;
        }

        if (old !== entity.selectedClientId) {
          updateList.push({id: entity.id, selectedClientId: entity.selectedClientId, depth: entity.depth});
        }
      }
    });

    if (updateList.length !== 0) {
      io.to(channels.GAME).emit(types.ENTITY_SELECT, updateList);
    }
  });

  onRequest(socket, types.ENTITY_MOVE_REQUEST, (entityArr, player) => {
    const moveList = [];
    entityArr.forEach(entity => {
      let ent = entities[entity.id];
      if (ent.selectedClientId === player.id) {
        ent.pos = entity.pos;
        ent.depth = ++nextEntityDepth;
        moveList.push({id: ent.id, pos: ent.pos, depth: ent.depth});
      }
    });

    if (moveList.length !== 0) {
      io.to(channels.GAME).emit(types.ENTITY_MOVE, moveList);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client ${remoteAddress} disconnected. (${socket.id})`);
    io.to(channels.GAME).emit(types.PLAYER_LEAVE,
                              [{id: players[getClientId(socket)].id}]);
    delete players[getClientId(socket)];
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
    if (!Object.keys(players).find(key => { return players[key].color === i; })) {
      return i;
    }
  }
}

function objectToList(object) {
  const result = [];
  Object.keys(object).forEach(key => result.push(object[key]));
  return result;
}

/**
 * @param {Type}
 * @return {Type}
 */
export default function () {
  return true
}
