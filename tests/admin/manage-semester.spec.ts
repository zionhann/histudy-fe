import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

const adminToken = [
   'header',
   Buffer.from(JSON.stringify({ rol: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
   'signature',
].join('.');

test.beforeEach(async ({ page }) => {
   await page.addInitScript((token) => {
      localStorage.setItem('accessToken', token);
   }, adminToken);

   await page.route('**/api/admin/academicTerm', async (route) => {
      await route.fulfill({
         json: {
            academicTerms: [{ academicTermId: 1, year: 2026, semester: 'SPRING', isCurrent: true }],
         },
      });
   });
});

test('관리자가 학기 관리에서 과목 업로드 양식을 다운로드한다', async ({ page }) => {
   const templateContent = '\uFEFFtitle,code,prof\r\n';
   await page.route('**/api/admin/academicTerm/course-template', async (route) => {
      await route.fulfill({
         status: 200,
         headers: {
            'Content-Type': 'text/csv;charset=UTF-8',
            'Content-Disposition': 'attachment; filename="course-upload-template.csv"',
         },
         body: Buffer.from(templateContent, 'utf8'),
      });
   });

   await page.goto('/admin/manage-semester');
   const downloadPromise = page.waitForEvent('download');
   await page.getByRole('button', { name: '강의 업로드 양식 다운로드', exact: true }).click();
   const download = await downloadPromise;

   expect(download.suggestedFilename()).toBe('course-upload-template.csv');
   const downloadedPath = await download.path();
   expect(downloadedPath).not.toBeNull();
   await expect(fs.readFile(downloadedPath!, 'utf8')).resolves.toBe(templateContent);
});
