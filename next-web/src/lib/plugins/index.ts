/**
 * Plugin Registry — Barrel Export
 *
 * Import this file to initialize all registered plugins.
 * Each plugin file auto-registers with PluginRegistry on import.
 */

// Core registry
export {
    PluginRegistry,
    defaultTaxPlugin,
    type TaxPlugin,
    type CompliancePlugin,
    type TaxLineItem,
    type TaxResult,
    type TaxContext,
    type TaxBreakdownEntry,
} from './registry';

// Country plugins (auto-register on import)
import './il';

// Future plugins:
// import './us';
// import './eu';
// import './gb';
