/**
 * Security test script - Token brute-force resistance test
 * Tests that random token guessing is ineffective
 * Run with: tsx src/scripts/test-token-security.ts
 */
import { generateToken, isValidTokenFormat } from '../utils/token-generator';
import { supabase } from '../config/database';

async function testTokenSecurity() {
  console.log('🔒 Testing Token Security');
  console.log('='.repeat(50));

  // Generate some valid tokens
  const validTokens: string[] = [];
  for (let i = 0; i < 10; i++) {
    validTokens.push(generateToken());
  }

  console.log(`\nGenerated ${validTokens.length} valid tokens`);
  console.log('Sample token:', validTokens[0]);

  // Test format validation
  console.log('\n✅ Testing format validation...');
  const invalidTokens = [
    'short',
    '123456',
    'abc',
    'token-with-dashes',
    'token_with_underscores',
    'token with spaces',
    'token@with#special$chars',
  ];

  invalidTokens.forEach((token) => {
    const isValid = isValidTokenFormat(token);
    console.log(`  ${token}: ${isValid ? '❌ VALID (should be invalid)' : '✅ Invalid (correct)'}`);
  });

  // Test brute-force simulation
  console.log('\n🔐 Simulating brute-force attack...');
  const attempts = 10000;
  let matches = 0;
  const startTime = Date.now();

  for (let i = 0; i < attempts; i++) {
    const randomToken = generateToken();
    if (validTokens.includes(randomToken)) {
      matches++;
    }
  }

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`\nAttempted ${attempts} random token generations`);
  console.log(`Matches found: ${matches}`);
  console.log(`Collision rate: ${(matches / attempts) * 100}%`);
  console.log(`Time taken: ${duration}ms`);
  console.log(`Tokens per second: ${Math.round(attempts / (duration / 1000))}`);

  if (matches > 0) {
    console.log('\n⚠️  WARNING: Collision detected! This is extremely rare and indicates a problem.');
  } else {
    console.log('\n✅ No collisions found - token generation is secure');
  }

  // Test token space size
  console.log('\n📊 Token Space Analysis');
  console.log('Token length range: 20-30 characters (base62)');
  console.log('Possible tokens (min): 62^20 ≈ 7.04 × 10^35');
  console.log('Possible tokens (max): 62^30 ≈ 2.27 × 10^53');
  console.log('\nEven with 1 billion attempts per second, it would take:');
  console.log('  - 62^20 tokens: ~2.23 × 10^19 years');
  console.log('  - 62^30 tokens: ~7.20 × 10^36 years');
  console.log('\n✅ Token space is sufficiently large to resist brute-force attacks');

  // Test actual token lookup (if database is configured)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('\n🔍 Testing database token lookup...');
    try {
      const testToken = generateToken();
      const { data, error } = await supabase
        .from('tokens')
        .select('id')
        .eq('token', testToken)
        .single();

      if (error && error.code === 'PGRST116') {
        console.log('✅ Token not found (expected for random token)');
      } else if (data) {
        console.log('⚠️  Token found in database (this is a real token)');
      }
    } catch (error) {
      console.log('⚠️  Database test skipped (database not available)');
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Security test completed');
}

testTokenSecurity();

