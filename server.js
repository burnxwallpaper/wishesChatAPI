const app = require('express')();
const cors = require('cors');
const port = process.env.PORT || 4000;
const server = require('http').createServer(app);
const io = require('socket.io')(server, { origins: '*:*' });
const mongoose = require('mongoose');
const DB_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatroomAPI'
const db = mongoose.connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
const Account = require('./dbAPI/accountModel');
const FdRoom = require('./dbAPI/fdRoomModel');

io.origins((origin, callback) => {
  /*if (origin !== 'https://wisheschatroom.herokuapp.com*') {
    console.log("'origin not allowed'")
    return callback('origin not allowed', false);
  }*/
  console.log(origin)
  callback(null, true);
});

app.use((req, res, next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": " GET,PUT,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "*",
    //"Access-Control-Allow-Credentials": "true",
    //"Content-Type": "text/html"
  })
  next()
})

/*const whitelist = ['http://localhost:3000', 'https://wisheschatroomapi.herokuapp.com', "https://wisheschatroom.herokuapp.com"];
const corsOptions = {
  credentials: true, // This is important.
  origin: (origin, callback) => {
    if (whitelist.includes(origin))
      return callback(null, true)

    callback(new Error('Not allowed by CORS!'));
  }
}*/
//app.use(cors(corsOptions));


//test
app.get('/', function (req, res) {
  res.send('Hello World!');
});

//globle
let onlineUsers = {};
let usernameList = []
let onlineCount = 0
let socketList = []

let roomInfo = {
  "1": [],
  "2": [],
  "3": []
};
let roomHost = {
  "1": "admin",
  "2": "admin",
  "3": "admin"
}
let userID = 0;
let times = 0

function findSocketIDByName(username) {
  let targetID
  for (let i = 0; i < socketList.length; i++) {
    if (socketList[i].username === username) {
      targetID = socketList[i].id
      break
    }
  }
  if (!targetID) { console.log("terget ID not found") }
  return targetID
}
function findSocketByName(username) {
  let soc
  for (let i = 0; i < socketList.length; i++) {
    if (socketList[i].username === username) {
      soc = socketList[i]
      break
    }
  }
  if (!soc) { console.log("Socket not found") }
  return soc
}


//start connect
io.on('connection', function (socket) {
  console.log("someone connected" + times)
  times++

  async function auth(username, password) {
    let res
    await Account.findOne({
      username: username
    }, function (err, user) {
      if (err) throw err
      if (!user) {
        console.log('Authenticate failed. User not found')
        res = false
      } else if (user) {
        if (user.password !== password) {
          console.log('Authenticate failed.  Wrong password')
          res = false
        } else {
          console.log('Auth success')
          res = user
        }
      }
    })
    return res
  }

  async function findPrivateChatMsg(soc) {
    let chatRecord = {}
    for (let i = 0; i < soc.fdRooms.length; i++) {
      let roomID = soc.fdRooms[i]
      await FdRoom.findById(roomID, function (err, room) {
        if (err) throw err
        chatRecord[roomID] = room
      })
    }
    return chatRecord
  }

  async function findFdWithIcon() {
    let fdListWithIcon = {}
    for (let i = 0; i < socket.friends.length; i++) {
      let fdName = socket.friends[i]
      await Account.findOne({ username: fdName }, function (err, fd) {
        if (err) throw err
        fdListWithIcon[fdName] = fd.iconImage || ""
      })
    }
    console.log(fdListWithIcon)
    return fdListWithIcon
  }
  function findAllUsersIcon() {
    let AllUsersIcon = {}
    for (let i = 0; i < socketList.length; i++) {
      let username = socketList[i].username
      AllUsersIcon[username] = socketList[i].iconImage || ""

    }
    console.log(AllUsersIcon)
    return AllUsersIcon
  }
  //login
  socket.on("login", async function (user) {
    if (!user.username) { console.log("user.username not found"); return }
    let account = await auth(user.username, user.password)
    if (!account) {
      console.log("Login fail");
      socket.emit("loginStatus", { loginStatus: false })
      return
    }

    else {
      socket.uid = userID
      socket.username = account.username
      socket.friends = account.friends
      socket.fdRooms = account.fdRooms
      socket.iconImage = account.iconImage
      socketList.push(socket)
      onlineUsers[userID] = user.username;
      userID++;
      for (let [userID, username] of Object.entries(onlineUsers)) {
        if (usernameList.includes(username)) { continue }
        usernameList.push(username)
        onlineCount++
      }
      let chatRecord = await findPrivateChatMsg(socket)
      let fdListWithIcon = await findFdWithIcon()
      let allUsersIcon = findAllUsersIcon()
      socket.emit("loginStatus", { loginStatus: true, accountInfo: account, chatRecord: chatRecord, fdListWithIcon: fdListWithIcon, allUsersIcon: allUsersIcon })
      socket.friends.map(async (username) => {
        let onlineFdSocID = await findSocketIDByName(username)
        if (onlineFdSocID) {
          io.to(onlineFdSocID).emit("systemMsg", { msg: `${socket.username} is online` })
        }
      })


      io.emit("userListUpdate", { usernameList: usernameList, allUsersIcon: allUsersIcon })

      console.log(onlineUsers)
      console.log("Login Success")
      console.log(account.username + '加入了,人數:' + onlineCount + ",成員:" + usernameList.toString());
    }
  })

  socket.on("requestRoomInfo", function () { socket.emit("roomListUpdate", { roomInfo, roomHost }) })
  socket.on("requestUserListInfo", function () { socket.emit("userListUpdate", { friendList: socket.friends, usernameList }) })


  socket.on('join', function (user) {
    let roomID = user.roomID
    socket.roomID = roomID;
    if (!roomID) { console.log("roomID not found"); return }
    if (!roomInfo[roomID]) roomInfo[roomID] = []
    roomInfo[roomID].push(socket.username)
    socket.join(roomID);
    io.to(roomID).emit('roomInfo', { userList: roomInfo[roomID] });
    io.to(roomID).emit('broadcast', { username: "admin", user: { username: socket.username }, join: true });
    io.emit('roomListUpdate', { roomInfo, roomHost });
    console.log(socket.username + '加入了房間' + roomID);
    console.log(roomInfo);
    socket.on("chat", outputChatMsg)
  })

  async function markMsgRead(roomID) {
    await FdRoom.findById(roomID, async (err, room) => {
      if (err) { console.log(err); return }
      let unreadCount = 0
      for (let i = 0; i < room.msg.length; i++) {
        if ((room.msg[i].read !== true) && (room.msg[i].talker !== socket.username)) {
          unreadCount++
          room.msg[i].read = true;
        }
      }
      room.markModified('msg');
      if (unreadCount > 0) {
        await room.save().then(async () => {
          console.log("read done")
          let msg = await findPrivateChatMsg(socket)
          socket.emit("chatRecordUpdate", { chatRecord: msg })
        })
      }
    })
  }
  socket.on("markMsgRead", () => markMsgRead(socket.roomID))
  socket.on('joinPrivateChat', async function (user) {
    let roomID = user.roomID
    if (!roomID) { console.log("roomID not found"); return }
    socket.roomID = roomID;
    socket.join(roomID);
    markMsgRead(roomID)
    socket.on("chat", outputPrivateChatMsg)
    console.log(socket.username + '加入了房間' + roomID);

  })


  function outputChatMsg(message) {
    io.to(socket.roomID).emit("broadcast", message);
    console.log(socket.username + "in room " + socket.roomID + " says: " + message.text)
  }

  function outputPrivateChatMsg(message) {
    io.to(socket.roomID).emit("broadcast", message);
    console.log(socket.username + "in room " + socket.roomID + " says: " + message.text)

    FdRoom.findById(socket.roomID, async function (err, room) {
      if (err) throw err;
      let roomUsers = room.users
      room.msg.push(
        {
          talker: socket.username,
          time: new Date(),
          content: message.text,
          read: false
        }
      )
      room.markModified('msg')
      await room.save()


      let fdACmsg = await findPrivateChatMsg(socket)
      //socket.emit("chatRecordUpdate", { chatRecord: msg })
      for (let i = 0; i < roomUsers.length; i++) {
        let fdSocketID = await findSocketIDByName(roomUsers[i])
        let soc = await findSocketByName(roomUsers[i])
        let msg = await findPrivateChatMsg(soc)
        io.to(fdSocketID).emit("chatRecordUpdate", { chatRecord: msg })
        console.log("msg sent to " + roomUsers[i])
      }

    })


  }


  socket.on("createRoom", function (newRoomInfo) {
    let { roomID, username } = newRoomInfo
    if (Object.keys(roomInfo).includes(roomID)) {
      socket.emit('systemMsg', { msg: `Room name has been used, please change another one` })
      console.log("repeated room")
      return
    }
    socket.emit('systemMsg', { success: true })
    roomInfo[roomID] = [];
    roomHost[roomID] = username;
    io.emit('roomListUpdate', { roomInfo, roomHost });
    console.log('created room' + roomID)

  })


  socket.on("fdRequestSent", async function (req) {
    let fdWantToAdd = await req.username
    let requestor = socket.username
    let fdWantToAddAC
    let requestorAC

    await Account.findOne({ username: fdWantToAdd }, (err, user) => {
      if (err) throw err
      fdWantToAddAC = user
      if (!user.fdRequestReceived) { user.fdRequestReceived = [] }
      if (!user.fdRequestReceived.includes(requestor)) {
        user.fdRequestReceived.push(requestor)
        user.save().then(() => {
          let fdSocketID = findSocketIDByName(fdWantToAdd)
          if (fdSocketID) {
            io.to(fdSocketID).emit("newFdRequest", { requestor: requestor })
            io.to(fdSocketID).emit("updateAccountInfo", { accountInfo: fdWantToAddAC })
            io.to(fdSocketID).emit("systemMsg", { msg: `You receive a friend request from ${requestor}.` })
          }
        })

      } else { console.log(requestorAC + " already added " + fdWantToAdd) }
    })
    await Account.findOne({ username: requestor }, (err, user) => {
      if (err) throw err
      requestorAC = user
      if (!user.fdRequestSent) { user.fdRequestSent = [] }
      if (!user.fdRequestSent.includes(fdWantToAdd)) {
        user.fdRequestSent.push(fdWantToAdd)
        user.save().then(() => {
          console.log(requestor + " want to add " + fdWantToAdd)
          socket.emit("updateAccountInfo", { accountInfo: requestorAC })
          socket.emit("systemMsg", { msg: `Friend request is sent to ${fdWantToAdd}!` })
        })
      } else {
        socket.emit("systemMsg", { msg: `You request to ${fdWantToAdd} is sent before.` })
      }
    })


  })

  socket.on("fdRequestAccept", async function (req) {
    let fdWantToAccept = req.username
    let acceptor = socket.username
    let fdWantToAcceptAC
    let acceptorAC
    let room = new FdRoom(
      {
        users: [fdWantToAccept, acceptor],
        msg: [],
        roomType: "private"
      }
    )
    await room.save()

    await Account.findOne({ username: acceptor }, (err, user) => {
      if (err) throw err
      let index = user.fdRequestReceived.indexOf(fdWantToAccept)
      user.fdRequestReceived.splice(index, 1)
      user.friends.push(fdWantToAccept)
      user.fdRooms.push(room._id.toString())
      socket.fdRooms.push(room._id.toString())
      acceptorAC = user
      user.save().then(
        async () => {
          let chatRecord = await findPrivateChatMsg(socket)
          console.log(chatRecord)
          socket.emit("updateAccountInfo", { accountInfo: acceptorAC })
          socket.emit("chatRecordUpdate", { chatRecord: chatRecord })
          socket.emit("systemMsg", { msg: `${fdWantToAccept} become your friend!` })
        }
      )
    })

    await Account.findOne({ username: fdWantToAccept }, (err, user) => {
      if (err) throw err
      let index = user.fdRequestSent.indexOf(fdWantToAccept)
      user.fdRequestSent.splice(index, 1)
      user.friends.push(acceptor)
      user.fdRooms.push(room._id.toString())
      let Fdsocket = findSocketByName(fdWantToAccept)
      if (Fdsocket) {
        findSocketByName(fdWantToAccept).fdRooms.push(room._id.toString())
      }
      fdWantToAcceptAC = user
      user.save().then(async () => {

        if (Fdsocket) {
          let chatRecord = await findPrivateChatMsg(Fdsocket)
          console.log(chatRecord)
          let fdSocketID = findSocketIDByName(fdWantToAccept)
          io.to(fdSocketID).emit("newFdAccept", { acceptor: acceptor })
          io.to(fdSocketID).emit("systemMsg", { msg: `${acceptor} become your friend!` })
          io.to(fdSocketID).emit("updateAccountInfo", { accountInfo: fdWantToAcceptAC })
          io.to(fdSocketID).emit("chatRecordUpdate", { chatRecord: chatRecord })
        }
      })
    })

    console.log(acceptor + " added " + fdWantToAccept)
  })

  socket.on("updateIcon", async function (req) {
    console.log(socket.username + " upload icon:" + req.imageURL)
    await Account.findOne({ username: socket.username }, (err, user) => {
      if (err) { console.log(err) }
      user.iconImage = req.imageURL
      user.save().then(() => {
        console.log("updateSuccess");
        socket.emit("updateAccountInfo", { accountInfo: user })
      })
    })
  })

  //leave room
  socket.on("leave", (user) => {
    let roomID = socket.roomID
    socket.roomID = null
    if (!roomID) { console.log("roomID not found"); return }
    socket.removeListener("chat", outputChatMsg)
    socket.removeListener("chat", outputPrivateChatMsg)
    socket.leave(roomID);

    if (roomInfo[roomID]) {
      let userIDIndex = roomInfo[roomID].indexOf(socket.username);
      roomInfo[roomID].splice(userIDIndex, 1);
      io.to(roomID).emit('broadcast', { username: "admin", user: { username: user.username }, join: false });
      io.to(roomID).emit('roomInfo', { userList: roomInfo[roomID] });
      if (roomHost[roomID] === user.username) {

        //change host
        if (roomInfo[roomID].length > 0) {
          roomHost[roomID] = roomInfo[roomID][0]
        }
        //delete room if no one
        else { delete roomInfo[roomID] }

      }
      io.emit('roomListUpdate', { roomInfo, roomHost });
      console.log(roomInfo);
    }
    console.log(user.username + '離開了房間' + roomID);

  })

  //creatAccount
  socket.on('createAccount', function (accountInfo) {
    let account = new Account({
      username: accountInfo.username,
      password: accountInfo.password,

      friends: [],
      fdRooms: [],
      fdRequestReceived: [],
      fdRequestSent: [],
    })
    account.save().then(() => {
      socket.emit("createAccountSuccess")
    })
  })

  //disconnect notice
  socket.on('disconnect', function () {
    if (onlineUsers.hasOwnProperty(socket.uid)) {
      let user = { userID: socket.uid, username: onlineUsers[socket.uid] };
      let roomID = socket.roomID;
      if (roomHost[roomID] === user.username) {

        //change host
        if (roomInfo[roomID].length > 0) {
          roomHost[roomID] = roomInfo[roomID][0]
        }
        //delete room if no one
        else { delete roomInfo[roomID] }

      }
      //remove socket from socketlist
      for (i = 0; i < socketList.length; i++) {
        if (socketList[i].username === onlineUsers[socket.uid]) {
          //notice otherfd logout
          socketList[i].friends.map(async (username) => {
            if (usernameList.includes(username)) {
              let onlineFdSocID = await findSocketIDByName(username)
              if (onlineFdSocID) {
                io.to(onlineFdSocID).emit("systemMsg", { msg: `${socket.username} is offline` })
              }
            }
          })
          socketList.splice(i, 1);
          break;
        }
      }


      // 删掉这个用户，在线人数-1
      delete onlineUsers[socket.uid];
      let roomID = socket.roomID
      onlineCount--
      if (roomInfo[roomID]) { roomInfo[roomID].splice(usernameList.indexOf(user.username), 1); }
      usernameList.splice(usernameList.indexOf(user.username), 1);
      //io.to(roomID).emit('roomInfo', { userList: roomInfo[roomID] });
      // 向客户端发送登出事件，同时发送在线用户、在线人数以及登出用户
      io.emit('broadcast', { onlineUsers: onlineUsers, onlineCount: onlineCount, user: user, username: "admin", join: false });
      io.emit("userListUpdate", { usernameList })

      console.log(user.username + '退出了,人數:' + onlineCount + ",成員:" + (usernameList.toString() || "沒人"));
      console.log(roomInfo)
    }

  });
});


server.listen(port, function () {
  console.log('listening on ' + port);
});



