import { describe, expect, it } from 'vitest';
import { targetAngle } from './PhotoCoin';

describe('photo coin turning', () => {
  it('turns the shortest way to the requested side', () => {
    expect(targetAngle(0, 'reverse')).toBe(180);
    expect(targetAngle(170, 'obverse')).toBe(0);
    expect(targetAngle(350, 'obverse')).toBe(360);
    expect(targetAngle(-100, 'reverse')).toBe(-180);
    expect(targetAngle(725, 'obverse')).toBe(720);
  });
});
