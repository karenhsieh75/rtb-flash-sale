import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'https://d28wqj892frr80.cloudfront.net';

test.describe('完整用户流程', () => {
  test('用户注册、登录、查看商品、出价、查看排行榜', async ({ page }) => {
    const timestamp = Date.now();
    const username = `e2e_user_${timestamp}`;
    const password = 'test123456';

    // 1. 访问首页
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/即时竞标/);

    // 2. 注册新用户
    await page.click('text=注册');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.selectOption('select[name="role"]', 'member');
    await page.click('button[type="submit"]');

    // 等待注册完成并跳转
    await page.waitForURL('**/products', { timeout: 10000 });

    // 3. 查看商品列表
    await expect(page.locator('text=商品列表')).toBeVisible();
    const products = page.locator('[data-testid="product-card"]');
    const productCount = await products.count();
    
    if (productCount > 0) {
      // 4. 进入商品详情页
      await products.first().click();
      await page.waitForURL('**/auction/**');

      // 5. 查看商品信息
      await expect(page.locator('text=商品详情')).toBeVisible();

      // 6. 出价
      const bidInput = page.locator('input[name="bidPrice"]');
      await bidInput.fill('1500');
      await page.click('button:has-text("提交出价")');

      // 等待出价成功提示
      await expect(page.locator('text=出价成功')).toBeVisible({ timeout: 5000 });

      // 7. 查看排行榜更新
      await expect(page.locator('text=实时战况')).toBeVisible();
      await expect(page.locator('text=排行榜')).toBeVisible();

      // 验证排行榜中有数据
      const rankings = page.locator('[data-testid="ranking-row"]');
      const rankingCount = await rankings.count();
      expect(rankingCount).toBeGreaterThan(0);
    }
  });

  test('管理员流程：登录、创建商品、编辑商品', async ({ page }) => {
    const timestamp = Date.now();
    const username = `e2e_admin_${timestamp}`;
    const password = 'test123456';

    // 1. 注册管理员
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.selectOption('select[name="role"]', 'admin');
    await page.click('button[type="submit"]');

    // 等待跳转到商品列表
    await page.waitForURL('**/products', { timeout: 10000 });

    // 2. 进入管理页面
    await page.click('text=管理商品');
    await page.waitForURL('**/admin/products');

    // 3. 创建新商品
    await page.click('button:has-text("新增商品")');
    
    const now = Date.now();
    const startTime = new Date(now + 60000); // 1分钟后开始
    const endTime = new Date(now + 3600000); // 1小时后结束

    await page.fill('input[name="title"]', 'E2E 测试商品');
    await page.fill('textarea[name="description"]', 'E2E 测试描述');
    await page.fill('input[name="basePrice"]', '1000');
    await page.fill('input[name="k"]', '5');
    await page.fill('input[name="startTime"]', startTime.toISOString().slice(0, 16));
    await page.fill('input[name="endTime"]', endTime.toISOString().slice(0, 16));
    await page.fill('input[name="alpha"]', '1.0');
    await page.fill('input[name="beta"]', '0.5');
    await page.fill('input[name="gamma"]', '0.3');

    await page.click('button:has-text("保存")');

    // 等待商品创建成功
    await expect(page.locator('text=商品创建成功')).toBeVisible({ timeout: 5000 });

    // 4. 验证商品出现在列表中
    await expect(page.locator('text=E2E 测试商品')).toBeVisible();
  });
});

test.describe('实时更新验证', () => {
  test('出价后排行榜自动更新', async ({ page, context }) => {
    // 创建两个浏览器上下文模拟两个用户
    const user1Context = await context.browser()?.newContext();
    const user2Context = await context.browser()?.newContext();
    
    if (!user1Context || !user2Context) {
      test.skip();
      return;
    }

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    const timestamp = Date.now();
    const username1 = `e2e_user1_${timestamp}`;
    const username2 = `e2e_user2_${timestamp}`;
    const password = 'test123456';

    // 用户1注册并登录
    await user1Page.goto(`${BASE_URL}/register`);
    await user1Page.fill('input[name="username"]', username1);
    await user1Page.fill('input[name="password"]', password);
    await user1Page.fill('input[name="confirmPassword"]', password);
    await user1Page.selectOption('select[name="role"]', 'member');
    await user1Page.click('button[type="submit"]');
    await user1Page.waitForURL('**/products');

    // 用户2注册并登录
    await user2Page.goto(`${BASE_URL}/register`);
    await user2Page.fill('input[name="username"]', username2);
    await user2Page.fill('input[name="password"]', password);
    await user2Page.fill('input[name="confirmPassword"]', password);
    await user2Page.selectOption('select[name="role"]', 'member');
    await user2Page.click('button[type="submit"]');
    await user2Page.waitForURL('**/products');

    // 用户1进入商品详情页
    const products = user1Page.locator('[data-testid="product-card"]');
    const productCount = await products.count();
    
    if (productCount > 0) {
      await products.first().click();
      await user1Page.waitForURL('**/auction/**');

      // 用户2也进入同一商品详情页
      await user2Page.goto(user1Page.url());

      // 用户2出价
      const bidInput = user2Page.locator('input[name="bidPrice"]');
      await bidInput.fill('2000');
      await user2Page.click('button:has-text("提交出价")');

      // 等待用户1的页面收到实时更新（WebSocket）
      await user1Page.waitForTimeout(2000); // 等待 WebSocket 推送

      // 验证用户1的页面显示了新的最高价
      await expect(user1Page.locator('text=2000')).toBeVisible({ timeout: 5000 });
    }

    await user1Context.close();
    await user2Context.close();
  });
});

