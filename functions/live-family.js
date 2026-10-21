"use strict";

// Keep a value listener attached while a transaction runs. Realtime Database
// may otherwise invoke its first transaction callback with an uncached null.
async function withLiveFamily(ref, work) {
  let listener;
  const family = await new Promise((resolve, reject) => {
    listener = snapshot => resolve(snapshot.val());
    ref.on("value", listener, reject);
  });
  try {
    return await work(family);
  } finally {
    ref.off("value", listener);
  }
}

module.exports = { withLiveFamily };
