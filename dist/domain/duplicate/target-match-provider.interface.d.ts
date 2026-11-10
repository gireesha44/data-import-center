/**
 * Target Match Provider Interface & Registry Contract
 */
import { ITargetMatchProvider, TargetRecordMatch } from '../../core/types/duplicate.types.js';
export { ITargetMatchProvider, TargetRecordMatch };
export interface ITargetMatchProviderRegistry {
    registerProvider(provider: ITargetMatchProvider): void;
    getProvider(entityName: string): ITargetMatchProvider | undefined;
    hasProvider(entityName: string): boolean;
    clear(): void;
}
//# sourceMappingURL=target-match-provider.interface.d.ts.map