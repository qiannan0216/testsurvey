/**
 * =========================================================================
 * 載入動畫對 QoE 與主觀時間評估實驗系統 - Google Sheets 自動同步指令碼
 * Google Apps Script (GAS) 部署程式碼
 * 
 * 試算表網址：https://docs.google.com/spreadsheets/d/189C7fUyeICFDIJeu26wi7f0pW905YhwtDD7Rktczxl4/edit
 * 
 * 核心特色：
 * 1. 【一人一列 (Wide Format)】：每位受試者全部 9 個實驗情境 (C01～C09) 回答完整彙整為同一列 (共 131 欄)。
 * 2. 【防重複與更新】：依據 ParticipantID 判斷，若受試者已存在則覆蓋更新該列，若不存在則新增一列。
 * 3. 【自動生成標準表頭】：若工作表為空或欄位不符，自動重設為 131 欄標準表頭並凍結首列。
 * 4. 【支援即時與批次同步】：受試者做完問卷自動即時上傳，或後台點擊「重新同步」批次上傳皆完美支援。
 * =========================================================================
 */

// 131 欄完整表頭定義 (一人一列，依序 C01 到 C09)
var CODES = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09'];
var BASE_HEADERS = ['ParticipantID', 'OrderGroup', 'Gender', 'AgeGroup', 'Timestamp'];
var PER_CODE_SUFFIXES = [
  'Order', 'Q1_Sec', 'Q2_TimePassage', 'Q3_Interest',
  'Q4_Happy', 'Q5_Comfortable', 'Q6_Relaxed', 'Q7_Stimulated', 'E_Avg',
  'Q8_Patient', 'Q9_Energetic', 'Q10_Powerful', 'U_Avg',
  'OverallQoE'
];

function getFullHeaders() {
  var headers = [].concat(BASE_HEADERS);
  for (var i = 0; i < CODES.length; i++) {
    var c = CODES[i];
    for (var j = 0; j < PER_CODE_SUFFIXES.length; j++) {
      headers.push(c + '_' + PER_CODE_SUFFIXES[j]);
    }
  }
  return headers;
}

// 1. 處理 GET 請求 (提供狀態檢查與已存在受試者代號列表)
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    var existingIds = [];
    if (lastRow > 1) {
      var idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var r = 0; r < idValues.length; r++) {
        var pid = String(idValues[r][0]).trim().toUpperCase();
        if (pid && existingIds.indexOf(pid) === -1) {
          existingIds.push(pid);
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      status: "active",
      message: "Google Sheets 同步服務運作正常！模式：一人一列 (C01～C09，共 131 欄)。",
      participantCount: existingIds.length,
      existingIds: existingIds
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. 處理 POST 請求 (接收受試者實驗數據並寫入試算表)
function doPost(e) {
  var lock = LockService.getScriptLock();
  // 嘗試取得鎖，防止多受試者同時提交造成寫入衝突 (最多等 30 秒)
  try {
    lock.waitLock(30000);
  } catch (t) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: "Lock timeout" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var rawContent = "";
    if (e && e.postData && e.postData.contents) {
      rawContent = e.postData.contents;
    } else if (e && e.parameter && e.parameter.data) {
      rawContent = e.parameter.data;
    }

    if (!rawContent) {
      return ContentService.createTextOutput(JSON.stringify({ result: "error", error: "No post data received" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(rawContent);
    // 同時支援單一受試者物件 {} 與批次陣列 [{}]
    var items = Array.isArray(data) ? data : [data];
    if (items.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ result: "empty", message: "No items to sync" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var headers = getFullHeaders();
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    // 檢查首列是否需要初始化或更新為 131 欄標準表頭
    var needHeaderInit = false;
    if (lastRow === 0 || lastCol < headers.length) {
      needHeaderInit = true;
    } else {
      var firstCell = sheet.getRange(1, 1).getValue();
      if (String(firstCell).trim() !== "ParticipantID") {
        needHeaderInit = true;
      }
    }

    if (needHeaderInit) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f1eee7");
      headerRange.setFontColor("#1c1917");
      sheet.setFrozenRows(1);
      lastRow = sheet.getLastRow();
    }

    // 建立現有受試者代號與列號映射，避免重複新增
    var existingRowMap = {};
    if (lastRow > 1) {
      var existingIdValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < existingIdValues.length; i++) {
        var id = String(existingIdValues[i][0]).trim().toUpperCase();
        if (id) {
          existingRowMap[id] = i + 2; // 第 2 列開始
        }
      }
    }

    var updatedCount = 0;
    var insertedCount = 0;

    // 逐筆處理受試者資料
    for (var k = 0; k < items.length; k++) {
      var item = items[k];
      var pId = String(item.ParticipantID || item.participantId || '').trim().toUpperCase();
      if (!pId) continue;

      // 依標準表頭欄位順序組成單列數據
      var rowValues = [];
      for (var h = 0; h < headers.length; h++) {
        var hName = headers[h];
        var val = item[hName];
        if (val === undefined || val === null) {
          val = '-';
        }
        rowValues.push(val);
      }

      // 若該受試者已在表格中，則原地更新該列；否則新增一列
      if (existingRowMap[pId]) {
        var targetRow = existingRowMap[pId];
        sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
        updatedCount++;
      } else {
        sheet.appendRow(rowValues);
        existingRowMap[pId] = sheet.getLastRow();
        insertedCount++;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      message: "同步成功！一人一列 (C01～C09)。",
      insertedCount: insertedCount,
      updatedCount: updatedCount,
      totalProcessed: items.length
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
