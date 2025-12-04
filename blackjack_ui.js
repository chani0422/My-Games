let Engine = null;
let engineReady = false;

Module().then((mod) => {
  Engine = mod;
  engineReady = true;
  console.log("Engine ready");
});
