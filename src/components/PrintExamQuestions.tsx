import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import type { Exam, Question } from '@/types/exam';

interface PrintExamQuestionsProps {
  exam: Exam;
  questions: Question[];
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function PrintExamQuestions({ exam, questions }: PrintExamQuestionsProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${exam.name} - ورقة الأسئلة</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            direction: rtl;
            padding: 20mm 15mm;
            color: #000;
            background: #fff;
            font-size: 14px;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            border-bottom: 3px double #000;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .header h1 {
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .header .subtitle {
            font-size: 13px;
            color: #333;
          }
          .exam-info {
            display: flex;
            justify-content: space-between;
            border: 1px solid #000;
            padding: 8px 14px;
            margin-bottom: 20px;
            font-size: 13px;
          }
          .exam-info div {
            display: flex;
            gap: 8px;
          }
          .exam-info span.label {
            font-weight: bold;
          }
          .student-fields {
            display: flex;
            gap: 30px;
            margin-bottom: 20px;
            font-size: 13px;
          }
          .student-fields .field {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .student-fields .field .line {
            border-bottom: 1px solid #000;
            min-width: 180px;
            display: inline-block;
          }
          .questions-container {
            counter-reset: question-counter;
          }
          .question {
            margin-bottom: 16px;
            page-break-inside: avoid;
          }
          .question-text {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 6px;
            display: flex;
            gap: 6px;
          }
          .question-text .q-num {
            min-width: 28px;
            font-weight: bold;
          }
          .options {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px 20px;
            padding-right: 34px;
          }
          .option {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 0;
          }
          .option .circle {
            width: 18px;
            height: 18px;
            border: 1.5px solid #000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            flex-shrink: 0;
          }
          .option .text {
            font-size: 13px;
          }
          .tf-options {
            display: flex;
            gap: 30px;
            padding-right: 34px;
          }
          .divider {
            border-top: 1px solid #ccc;
            margin: 10px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 12px;
            border-top: 1px solid #000;
            font-size: 12px;
            color: #555;
          }
          @media print {
            body { padding: 15mm 12mm; }
            .question { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${exam.name}</h1>
          <div class="subtitle">ورقة الأسئلة</div>
        </div>

        <div class="exam-info">
          <div><span class="label">عدد الأسئلة:</span> <span>${questions.length}</span></div>
          <div><span class="label">الدرجة الكلية:</span> <span>${exam.maxScore}</span></div>
        </div>

        <div class="student-fields">
          <div class="field">
            <span class="label">اسم الطالب:</span>
            <span class="line"></span>
          </div>
          <div class="field">
            <span class="label">التاريخ:</span>
            <span class="line" style="min-width:120px"></span>
          </div>
        </div>

        <div class="questions-container">
          ${questions.map((q, i) => `
            <div class="question">
              <div class="question-text">
                <span class="q-num">${i + 1}.</span>
                <span>${escapeHtml(q.text)}</span>
              </div>
              ${q.type === 'true_false' ? `
                <div class="tf-options">
                  ${q.options.map((opt, oi) => `
                    <div class="option">
                      <div class="circle">${OPTION_LABELS[oi]}</div>
                      <span class="text">${escapeHtml(opt.text)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div class="options">
                  ${q.options.map((opt, oi) => `
                    <div class="option">
                      <div class="circle">${OPTION_LABELS[oi]}</div>
                      <span class="text">${escapeHtml(opt.text)}</span>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
            ${i < questions.length - 1 ? '<div class="divider"></div>' : ''}
          `).join('')}
        </div>

        <div class="footer">
          انتهت الأسئلة - بالتوفيق والنجاح
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }, [exam, questions]);

  return (
    <>
      <Button variant="ghost" size="icon" onClick={handlePrint} title="طباعة ورقة الأسئلة">
        <Printer className="h-4 w-4" />
      </Button>
      {/* Hidden ref for potential future use */}
      <div ref={printRef} className="hidden" />
    </>
  );
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

