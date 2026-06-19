import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet } from 'lucide-react';

/**
 * Static answer sheet template for paper-based exams.
 * Supports up to 100 questions in 4 columns of 25 rows.
 * Features 4 corner alignment markers for OMR camera scanning.
 */

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const ROWS_PER_COLUMN = 25;
const TOTAL_QUESTIONS = 100;
const COLUMNS = 4;
// Marker size in mm
const MARKER_SIZE = 8;

export function PrintAnswerSheet() {
  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Generate the grid columns
    const columns: string[] = [];
    for (let col = 0; col < COLUMNS; col++) {
      const startQ = col * ROWS_PER_COLUMN + 1;
      const endQ = startQ + ROWS_PER_COLUMN - 1;
      let rows = '';
      for (let q = startQ; q <= endQ; q++) {
        const bubbles = OPTION_LABELS.map(
          (label) => `
          <span class="bubble" data-q="${q}" data-opt="${label}">
            <span class="bubble-inner">${label}</span>
          </span>`
        ).join('');
        rows += `
          <div class="answer-row" data-q="${q}">
            <span class="q-num">${q}</span>
            <span class="bubbles">${bubbles}</span>
          </div>`;
      }
      columns.push(`
        <div class="answer-column">
          <div class="col-header">
            <span>${startQ} - ${endQ}</span>
          </div>
          ${rows}
        </div>
      `);
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>ورقة الإجابة</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          @page {
            size: A4;
            margin: 0;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            direction: rtl;
            color: #000;
            background: #fff;
            width: 210mm;
            min-height: 297mm;
            position: relative;
            padding: 18mm 12mm 18mm 12mm;
          }

          /* ── Corner Alignment Markers ── */
          .marker {
            position: absolute;
            width: ${MARKER_SIZE}mm;
            height: ${MARKER_SIZE}mm;
            background: #000;
          }
          .marker-tl { top: 6mm; left: 6mm; }
          .marker-tr { top: 6mm; right: 6mm; }
          .marker-bl { bottom: 6mm; left: 6mm; }
          .marker-br { bottom: 6mm; right: 6mm; }

          /* ── Header Section ── */
          .sheet-header {
            text-align: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 2px solid #000;
          }
          .sheet-header h1 {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 2px;
          }
          .sheet-header .subtitle {
            font-size: 12px;
            color: #333;
          }

          /* ── Student Info Fields ── */
          .info-fields {
            display: flex;
            gap: 20px;
            margin-bottom: 10px;
            font-size: 12px;
            flex-wrap: wrap;
          }
          .info-field {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .info-field .label {
            font-weight: bold;
            white-space: nowrap;
          }
          .info-field .line {
            border-bottom: 1px solid #000;
            min-width: 140px;
            height: 18px;
            display: inline-block;
          }

          /* ── Instructions ── */
          .instructions {
            font-size: 10px;
            color: #333;
            margin-bottom: 10px;
            padding: 4px 8px;
            border: 1px solid #999;
            border-radius: 3px;
            background: #f9f9f9;
          }
          .instructions strong {
            color: #000;
          }

          /* ── Answer Grid ── */
          .answer-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            direction: ltr; /* bubbles always LTR for A B C D */
          }

          .answer-column {
            border: 1px solid #000;
            border-radius: 2px;
          }

          .col-header {
            text-align: center;
            font-weight: bold;
            font-size: 10px;
            padding: 3px 0;
            background: #e0e0e0;
            border-bottom: 1px solid #000;
          }

          .answer-row {
            display: flex;
            align-items: center;
            padding: 1.8px 4px;
            border-bottom: 0.5px solid #ddd;
          }
          .answer-row:last-child {
            border-bottom: none;
          }

          .q-num {
            font-size: 10px;
            font-weight: bold;
            min-width: 22px;
            text-align: center;
          }

          .bubbles {
            display: flex;
            gap: 4px;
            flex: 1;
            justify-content: center;
          }

          .bubble {
            width: 16px;
            height: 16px;
            border: 1.5px solid #000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .bubble-inner {
            font-size: 8px;
            font-weight: bold;
            line-height: 1;
          }

          /* ── Footer ── */
          .sheet-footer {
            margin-top: 10px;
            text-align: center;
            font-size: 10px;
            color: #666;
            padding-top: 6px;
            border-top: 1px solid #000;
          }

          @media print {
            body {
              padding: 18mm 12mm;
              width: 210mm;
              height: 297mm;
            }
            .marker { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .col-header { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .instructions { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <!-- Corner Alignment Markers for OMR scanning -->
        <div class="marker marker-tl"></div>
        <div class="marker marker-tr"></div>
        <div class="marker marker-bl"></div>
        <div class="marker marker-br"></div>

        <div class="sheet-header">
          <h1>ورقة الإجابة</h1>
          <div class="subtitle">Answer Sheet</div>
        </div>

        <div class="info-fields">
          <div class="info-field">
            <span class="label">اسم الطالب:</span>
            <span class="line"></span>
          </div>
          <div class="info-field">
            <span class="label">اسم الاختبار:</span>
            <span class="line"></span>
          </div>
          <div class="info-field">
            <span class="label">التاريخ:</span>
            <span class="line" style="min-width:100px"></span>
          </div>
        </div>

        <div class="instructions">
          <strong>تعليمات:</strong>
          ظلّل الدائرة المناسبة بالكامل باستخدام قلم رصاص أو قلم أسود. لا تضع علامات خارج الدوائر.
          للأسئلة صح/خطأ: A = صح، B = خطأ.
          <br/>
          <strong>Instructions:</strong>
          Fill the correct bubble completely using a pencil or black pen. Do not mark outside the bubbles.
          For True/False: A = True, B = False.
        </div>

        <div class="answer-grid">
          ${columns.join('')}
        </div>

        <div class="sheet-footer">
          لا تكتب في هذه المنطقة — Do not write in this area
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }, []);

  return (
    <Button variant="ghost" size="icon" onClick={handlePrint} title="طباعة ورقة الإجابة">
      <FileSpreadsheet className="h-4 w-4" />
    </Button>
  );
}

