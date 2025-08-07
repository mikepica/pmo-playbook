# 🤖 AI Configuration System

## Overview

This system provides centralized configuration management for all AI behavior in the PMO Playbook application. Everything is controlled through a single YAML file: `ai-config.yaml`.

## ✨ Key Features

- **🎯 Multi-SOP Support**: Can use 1-3 SOPs per query for comprehensive answers
- **📝 Dynamic Prompts**: Template engine with variables, conditionals, and loops  
- **⚙️ Centralized Config**: All AI settings in one easy-to-edit file
- **🔄 Hot Reload**: Changes automatically picked up in development
- **🛠️ CLI Management**: Built-in tools for validation and testing
- **🌍 Environment Support**: Different configs for dev/staging/production

## 📁 Files Structure

```
/ai-config.yaml                    # Main configuration file
/src/lib/ai-config.ts              # Configuration loader & manager
/src/lib/template-engine.ts        # Prompt template processing
/src/lib/ai-sop-selection-v2.ts    # Enhanced AI logic using config
/scripts/ai-config-manager.ts      # CLI management tool
```

## 🎛️ Configuration Sections

### Models
```yaml
models:
  primary: "gpt-4o"           # Main AI model for complex tasks
  summarization: "gpt-4o-mini" # Lightweight model for summaries
  fallback: "gpt-4o-mini"     # Backup when primary fails
```

### Multi-SOP Settings
```yaml
multi_sop:
  enabled: true               # Enable multi-SOP responses
  max_sops_per_query: 5       # Maximum SOPs per answer (1-5)
  min_relevance_score: 0.4    # Minimum score to include SOP
  combination_strategy: "hierarchical"  # How to combine SOPs
  allow_cross_references: true # Show connections between SOPs
```

### AI Modes
```yaml
modes:
  sop_selection:              # Step 1: Choose which SOPs to use
    model: "gpt-4o"
    temperature: 0.2          # Low = consistent choices
    max_tokens: 500           # Reasonably short responses
    
  sop_generation:             # Step 2: Generate SOP-based answers  
    model: "gpt-4o"
    temperature: 0.4          # Balanced creativity/accuracy
    max_tokens: 3000          # Long, detailed responses
    
  general_knowledge:          # Step 3: Use PM expertise when no SOP fits
    model: "gpt-4o"
    temperature: 0.6          # More creative/conversational
    max_tokens: 2500          # Comprehensive but focused
```

### Flow Control
```yaml
flow:
  confidence_threshold: 0.6         # When to prefer general knowledge
  conversation_history_limit: 4     # Messages to include for context
  fallback_to_general: true        # Use general PM knowledge as backup
  enable_cross_phase_queries: true # Handle questions spanning phases
  max_context_tokens: 8000         # Total token budget
```

## 📝 Template System

The system uses a powerful template engine for dynamic prompts:

### Variable Interpolation
```yaml
prompts:
  example: |
    User asked: "{{userQuery}}"
    Available SOPs: {{sopList}}
    History limit: {{flow.conversation_history_limit}}
```

### Conditionals
```yaml
prompts:
  example: |
    {{#if conversationHistory}}
    Previous context: {{conversationHistory}}
    {{/if}}
    
    {{#if hasSupportingSops}}
    Supporting SOPs are available.
    {{/if}}
```

### Loops
```yaml
prompts:
  example: |
    {{#each selectedSops}}
    SOP {{@index1}}: {{this.sopId}} ({{this.role}})
    {{/each}}
```

## 🚀 Usage Examples

### Basic Configuration Changes

**Adjust AI Creativity:**
```yaml
modes:
  general_knowledge:
    temperature: 0.8  # More creative responses
```

**Enable More SOPs per Query:**
```yaml
multi_sop:
  max_sops_per_query: 5  # Allow up to 5 SOPs
```

**Change Models:**
```yaml
models:
  primary: "gpt-4o-mini"  # Use faster/cheaper model
```

### Environment-Specific Settings
```yaml
environments:
  development:
    modes:
      sop_selection:
        temperature: 0.3  # Higher for testing
    debug:
      log_token_usage: true
      
  production:
    flow:
      max_context_tokens: 7500  # Conservative limit
    debug:
      log_token_usage: false
```

### Custom Prompts
```yaml
prompts:
  custom_selection: |
    You are a {{expertise_level}} PMO consultant.
    
    Question: "{{userQuery}}"
    
    {{#if urgentRequest}}
    ⚡ URGENT REQUEST - Prioritize speed and clarity.
    {{/if}}
    
    Available procedures:
    {{#each sopList}}
    - {{this.sopId}}: {{this.title}} (Phase {{this.phase}})
      Focus: {{this.summary}}
    {{/each}}
```

## 🛠️ CLI Management

### Validate Configuration
```bash
npm run ai-config validate
```
Checks syntax, validates prompts, verifies settings.

### Test with Sample Data
```bash
npm run ai-config test
```
Processes templates with mock data to verify functionality.

### Preview Prompts
```bash
npm run ai-config preview
```
Shows how prompts look with sample data.

### Export to JSON
```bash
npm run ai-config export
```
Creates `ai-config-export.json` for debugging.

### Force Reload (Dev)
```bash
npm run ai-config reload
```
Hot-reloads configuration in development.

## 🎯 Multi-SOP Query Examples

### Single SOP Response
```
User: "How do I create a project charter?"
→ Uses: SOP-001 (Project Initiation)
→ Strategy: single_sop
```

### Multi-SOP Response  
```
User: "How do risks connect to stakeholder management?"
→ Uses: SOP-003 (Risk Management), SOP-002 (Stakeholder Management)  
→ Strategy: multi_sop
→ Shows cross-references and connections
```

### General Knowledge Response
```
User: "What's the difference between Agile and Waterfall?"
→ Uses: General PM expertise (no specific SOPs)
→ Strategy: general_knowledge
→ Draws from industry standards
```

## 🔧 Advanced Customization

### Custom SOP Selection Logic
```yaml
modes:
  sop_selection:
    strategy: "multi_select"
    scoring_algorithm: "semantic_similarity"
    # Custom instructions in prompts section
```

### Token Management
```yaml
validation:
  max_total_tokens: 10000     # Hard limit for safety
  
flow:
  max_context_tokens: 8000    # Soft limit for requests
```

### Feature Flags
```yaml
features:
  enable_multi_sop: true          # Toggle multi-SOP functionality
  enable_cross_references: true   # Show SOP connections
  enable_conversation_memory: true # Include chat history
  enable_hot_reload: true         # Auto-reload in dev
```

### Debug Settings
```yaml
debug:
  log_token_usage: true           # Track token consumption
  log_confidence_scores: true     # Show AI confidence levels
  log_sop_selection_reasoning: true # Why SOPs were chosen
  save_failed_queries: true       # Store problematic queries
```

## 🚨 Best Practices

### ✅ Do's
- **Test changes** with `npm run ai-config validate` before deployment
- **Use environment overrides** for production settings
- **Keep prompts focused** - overly complex templates are hard to debug
- **Monitor token usage** to stay within budget
- **Version control** your configuration changes

### ❌ Don'ts  
- **Don't exceed token limits** - requests will fail
- **Don't use extreme temperatures** (>1.0) unless testing
- **Don't edit prompts** without understanding template syntax
- **Don't disable validation** in production
- **Don't hardcode values** - use variables instead

## 🐛 Troubleshooting

### Configuration Won't Load
1. Check YAML syntax with `npm run ai-config validate`
2. Verify all required sections exist
3. Check file permissions and paths

### Prompts Not Working
1. Use `npm run ai-config preview` to see processed prompts
2. Check template variable names match configuration
3. Validate template syntax with CLI tool

### Poor AI Responses  
1. Adjust temperature settings (higher = more creative)
2. Increase max_tokens for longer responses
3. Check if confidence thresholds are too restrictive
4. Review prompt instructions for clarity

### Token Limit Exceeded
1. Reduce `max_context_tokens` in flow settings
2. Lower `conversation_history_limit`
3. Simplify prompt templates
4. Use shorter SOP summaries

## 🔄 Migration from Old System

The new system maintains backward compatibility through legacy wrapper functions. The old `selectBestSOP()` and `generateAnswer()` functions still work but internally use the new multi-SOP system.

To fully migrate:
1. Update imports to use `ai-sop-selection-v2.ts`
2. Handle multi-SOP responses in UI components
3. Update chat history to support multiple SOP IDs
4. Test all flows with the new attribution format

## 📈 Performance Impact

- **Memory**: ~5-10MB additional for configuration caching
- **Startup**: ~100-200ms for initial config load
- **Runtime**: Negligible overhead per request
- **Token Usage**: 10-20% increase due to enhanced prompts (offset by better targeting)

The multi-SOP system may use more tokens but provides significantly better answers by combining relevant information sources.

## 🎯 Future Enhancements

- **A/B Testing**: Compare different configurations automatically
- **Usage Analytics**: Track which configurations perform better
- **Prompt Optimization**: AI-assisted prompt improvement
- **Visual Config Editor**: Web UI for non-technical configuration editing
- **Smart Defaults**: AI-recommended configuration based on usage patterns