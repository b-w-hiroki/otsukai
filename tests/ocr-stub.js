// tesseract.js の代わりに読み込まれるテスト用スタブ。
// window.__ocrStubText を各テストが事前に page.evaluate で設定しておくと、
// runReceiptOcr() がその文字列を「読み取った」ことにする。
// 未設定なら空文字（＝金額を検出できないケース）を返す。
window.Tesseract = {
  createWorker: async function () {
    return {
      recognize: async function () {
        return { data: { text: window.__ocrStubText || "" } };
      },
      terminate: async function () {},
    };
  },
};
