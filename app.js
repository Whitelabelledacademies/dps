const express = require("express");
const localtunnel = require("localtunnel");
var JavaScriptObfuscator = require("javascript-obfuscator");
const url = require("url");
const axios = require("axios");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
  (async () => {
    const tunnel = await localtunnel({
      port: 3000,
      subdomain: "bp102",
    });

    // the assigned public url for your tunnel
    // i.e. https://abcdefgjhij.localtunnel.me
    console.log("Tunnel", tunnel.url);

    tunnel.on("close", () => {
      // tunnels are closed
      console.log("Tunnel Closed");
    });
  })();
}

const app = express();
const sheet_url = process.env.SHEET_URL;

app.get("/obs.js", async (req, res) => {
  try {
    // get referer from request
    if (!req.headers.referer) {
      // NO referer
      return res.status(404).send("404");
    }
    let reqReferer = url.parse(req.headers.referer).host;
    console.log(
      reqReferer,
      "|",
      Date(),
      "|",
      req.headers["x-forwarded-for"] || req.socket.remoteAddress
    );
    let query = encodeURI(`SELECT A WHERE A='${reqReferer}'`);
    const response = await axios.get(`${sheet_url}/gviz/tq?tq=${query}`);
    const str = response.data;
    // https://stackoverflow.com/questions/31765773/converting-google-visualization-query-result-into-javascript-array
    const resData = JSON.parse(str.match(/(?<=.*\().*(?=\);)/s)[0]);
    if (resData.status !== "ok") {
      // Response status error
      throw "ERROR_IN_SHEETS_REQ";
    }
    console.log(resData.table);
    if (!resData.table.rows.length) {
      // {
      //   cols: [ { id: 'A', label: '', type: 'string' } ],
      //   rows: [],
      //   parsedNumHeaders: 0
      // }
      // Request referer not in whitelist
      throw "NOT_ALLOWED";
    }
    var obfuscationResult = obfuscateCode();
    res.send(obfuscationResult);
  } catch (error) {
    console.error(error);
    if (error === "NOT_ALLOWED") {
      var obfuscationResult = obfuscateCodeBad();
      return res.send(obfuscationResult);
    }
    res.send("500");
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server Started");
});

function obfuscateCode() {
  const now = Date.now();
  // {now + 300000} valid for 5 minutes
  return JavaScriptObfuscator.obfuscate(
    `
      (function(){
        if(Date.now()<${now + 300000}){
          var style = document.createElement("style");
          style.type = "text/css";
          style.innerHTML = ".atcBtnStyle { display:flex !important;justify-content:center} .atcBtnStyle::after{content:'1';background:#fd5c5c;padding: 2px 6px;border-radius: 12px;margin-left:10px;}";
          document.getElementsByTagName("head")[0].appendChild(style);
          
          if (document.querySelector(".cart-i")) {
            const tag = document.createElement("span");
            const text = document.createTextNode("0");
            tag.id = "cart-total-items"
            tag.appendChild(text);
            tag.style.cssText = "background: red;color: white;padding: 4px 7px;border-radius: 20px;position: absolute;left: 51%;transform: translateX(-50%);font-family: Montserrat;opacity: 0.8;"
            const cart_icon = document.querySelector(".cart-i").parentNode;
            cart_icon.appendChild(tag);
          }
          const cb_inputs = document.querySelectorAll(".form-payment .radioBtn input[type=checkbox]");
          cb_inputs.forEach((ip, index) => {
            ip.setAttribute("atc-cb-input", index + 1);
            if (ip.checked) {
              ip.click();
            }
            ip.addEventListener("click", (e) => {
              showCount()
              const id = ip.getAttribute("atc-cb-input");
              // console.log(id)
              if (ip.checked) {
                document.querySelector("button.pro-b-" + id).classList.add("atcBtnStyle");
                return;
              }
              document.querySelector("button.pro-b-" + id).classList.remove("atcBtnStyle");
            });
          });
          
          const btns = document.querySelectorAll("button[class*='pro-b-']");
          const b_pattern = 'pro-b-';
          btns.forEach((btn) => {
            const classes = btn.classList;
            for (let i = 0; i < classes.length; i++) {
              const c = classes[i];
              // check if this class starts with 'pro-b-'
              const id = c.slice(0,6) === b_pattern ? c.slice(6) : null;
              if (id) {
                btn.addEventListener("click", (e) => {
                  e.preventDefault();
                  toggleInput(id);
                  showCount()
                });
                break;
              }
            }
          });
          const showCount = ()=>{
            const count_span = document.getElementById('cart-total-items')
            if(count_span){
              document.getElementById('cart-total-items').innerText = document.querySelectorAll(".form-payment .radioBtn input[type=checkbox]:checked").length
            }
          }
          const toggleInput = (id) => {
            // toggle border for button
            let btn = document.querySelector("button.pro-b-" + id);
            btn.classList.toggle("atcBtnStyle");
            // click on corresponding checkbox
            let inputs = document.querySelectorAll(
              ".form-payment .radioBtn input[type=checkbox]"
            );
            inputs[id - 1].click();
          };
          
          const pro_imgs = document.querySelectorAll("img[class*='pro-i-']");
          const i_pattern = 'pro-i-';
          pro_imgs.forEach((i) => {
            let img = i.cloneNode(true);
            const classes = img.classList;
            for (let i = 0; i < classes.length; i++) {
              const c = classes[i];
              // check if this class starts with 'pro-b-'
              const id = c.slice(0,6) === i_pattern ? c.slice(6) : null;
              // console.log(img, id);
              if (id) {
                let parent = document.querySelector("[atc-cb-input='" + id + "']")
                  ?.parentElement?.parentElement;
                img.width = 125;
                img.classList.remove("pro-i-"+id)
                parent.prepend(img);
                parent.style.alignItems = "center";
                parent = parent.parentElement;
                parent.style.alignItems = "center";
                break;
              }
            }
          });
          
          const items_section = document.querySelector("section.product-detail");
          const form_input = document.querySelector("form.form-payment");
          form_input.append(items_section);
          return  
        }    
        document.body.innerHTML = ""
      })();
        `,
    {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 1,
      numbersToExpressions: true,
      simplify: true,
      stringArrayShuffle: true,
      splitStrings: true,
      stringArrayThreshold: 1,
    }
  ).getObfuscatedCode();
}

function obfuscateCodeBad() {
  const now = Date.now();
  return JavaScriptObfuscator.obfuscate(
    `
        (function(){
        document.body.innerHTML = ""
        })();
      `,
    {
      compact: false,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 1,
      numbersToExpressions: true,
      simplify: true,
      stringArrayShuffle: true,
      splitStrings: true,
      stringArrayThreshold: 1,
    }
  ).getObfuscatedCode();
}
