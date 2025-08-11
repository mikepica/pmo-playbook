// Template Engine for AI Prompts
// Supports variable interpolation, conditionals, and loops

export interface TemplateContext {
  [key: string]: any;
}

export interface SOPContext {
  sopId: string;
  title: string;
  format?: string;
  summary: string;
  sections: {
    objectives: string[];
    keyActivities: string[];
    deliverables: string[];
    rolesResponsibilities: Array<{
      role: string;
      responsibilities: string[];
    }>;
    toolsTemplates: string[];
  };
}

export class TemplateEngine {
  /**
   * Process a template string with the given context
   */
  public static process(template: string, context: TemplateContext): string {
    let result = template;

    // Process simple variable interpolations {{variable}}
    result = this.processVariables(result, context);

    // Process conditionals {{#if condition}}...{{/if}}
    result = this.processConditionals(result, context);

    // Process loops {{#each array}}...{{/each}}
    result = this.processLoops(result, context);

    // Clean up extra whitespace
    result = this.cleanWhitespace(result);

    return result;
  }

  /**
   * Process simple variable interpolations
   */
  private static processVariables(template: string, context: TemplateContext): string {
    return template.replace(/\{\{([^#/][^}]*)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const value = this.getNestedValue(context, trimmedPath);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Process conditional blocks {{#if condition}}...{{/if}}
   */
  private static processConditionals(template: string, context: TemplateContext): string {
    const conditionalRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(conditionalRegex, (match, condition, content) => {
      const conditionValue = this.evaluateCondition(condition.trim(), context);
      return conditionValue ? content : '';
    });
  }

  /**
   * Process loop blocks {{#each array}}...{{/each}}
   */
  private static processLoops(template: string, context: TemplateContext): string {
    const loopRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return template.replace(loopRegex, (match, arrayPath, content) => {
      const array = this.getNestedValue(context, arrayPath.trim());
      
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map((item, index) => {
        const itemContext = {
          ...context,
          'this': item,
          '@index': index,
          '@index1': index + 1,
          '@first': index === 0,
          '@last': index === array.length - 1
        };
        
        return this.processVariables(content, itemContext);
      }).join('');
    });
  }

  /**
   * Evaluate a condition for {{#if}}
   */
  private static evaluateCondition(condition: string, context: TemplateContext): boolean {
    try {
      const value = this.getNestedValue(context, condition);
      
      // Handle various truthy/falsy conditions
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      
      if (typeof value === 'number') {
        return value !== 0;
      }
      
      return Boolean(value);
    } catch {
      return false;
    }
  }

  /**
   * Get nested object value by dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => {
      return current?.[prop];
    }, obj);
  }

  /**
   * Clean up extra whitespace while preserving intentional formatting
   */
  private static cleanWhitespace(text: string): string {
    return text
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove triple+ newlines
      .replace(/^\s+|\s+$/g, '') // Trim start/end
      .replace(/\n\s+\n/g, '\n\n'); // Clean empty lines with spaces
  }
}

/**
 * Template builder for common AI prompt patterns
 */
export class AIPromptBuilder {
  /**
   * Build SOP selection prompt with context
   */
  public static buildSOPSelectionPrompt(
    userQuery: string, 
    sopList: Array<{ sopId: string; title: string; phase: number; summary: string; keyActivities: string[]; deliverables: string[]; keywords: string[] }>,
    template: string,
    additionalContext: TemplateContext = {}
  ): string {
    const context: TemplateContext = {
      userQuery,
      sopList: this.formatSOPList(sopList),
      ...additionalContext
    };

    return TemplateEngine.process(template, context);
  }

  /**
   * Build multi-SOP generation prompt
   */
  public static buildMultiSOPPrompt(
    userQuery: string,
    primarySop: SOPContext,
    supportingSops: SOPContext[],
    conversationHistory: Array<{ role: string; content: string }>,
    template: string,
    additionalContext: TemplateContext = {}
  ): string {
    const context: TemplateContext = {
      userQuery,
      primarySop,
      supportingSops,
      isPrimarySop: Boolean(primarySop),
      hasSupportingSops: supportingSops.length > 0,
      conversationHistory: this.formatConversationHistory(conversationHistory),
      ...additionalContext
    };

    return TemplateEngine.process(template, context);
  }

  /**
   * Build general knowledge prompt
   */
  public static buildGeneralKnowledgePrompt(
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }>,
    template: string,
    additionalContext: TemplateContext = {}
  ): string {
    const context: TemplateContext = {
      userQuery,
      conversationHistory: this.formatConversationHistory(conversationHistory),
      hasConversationHistory: conversationHistory.length > 0,
      ...additionalContext
    };

    return TemplateEngine.process(template, context);
  }

  /**
   * Format SOP list for template consumption
   */
  private static formatSOPList(
    sopList: Array<{ 
      sopId: string; 
      title: string; 
      phase: number; 
      summary: string; 
      keyActivities: string[]; 
      deliverables: string[]; 
      keywords: string[] 
    }>
  ): string {
    return sopList.map(sop => `- sopId: ${sop.sopId}
   title: "${sop.title}"
   phase: ${sop.phase}
   summary: "${sop.summary}"
   key_activities: "${sop.keyActivities?.slice(0, 3).join(', ') || 'N/A'}"
   deliverables: "${sop.deliverables?.slice(0, 3).join(', ') || 'N/A'}"
   keywords: "${sop.keywords?.join(', ') || 'N/A'}"`).join('\n\n');
  }

  /**
   * Format conversation history for template consumption
   */
  private static formatConversationHistory(
    history: Array<{ role: string; content: string }>
  ): string {
    if (history.length === 0) {
      return '';
    }

    return history.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');
  }
}

/**
 * Utility functions for template processing
 */
export class TemplateUtils {
  /**
   * Validate template syntax
   */
  public static validateTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for unmatched tags
    const ifTags = (template.match(/\{\{#if/g) || []).length;
    const endIfTags = (template.match(/\{\{\/if\}\}/g) || []).length;
    if (ifTags !== endIfTags) {
      errors.push(`Unmatched {{#if}} tags: ${ifTags} opening, ${endIfTags} closing`);
    }

    const eachTags = (template.match(/\{\{#each/g) || []).length;
    const endEachTags = (template.match(/\{\{\/each\}\}/g) || []).length;
    if (eachTags !== endEachTags) {
      errors.push(`Unmatched {{#each}} tags: ${eachTags} opening, ${endEachTags} closing`);
    }

    // Check for malformed variable references
    const malformedVars = template.match(/\{\{[^}]*$/g);
    if (malformedVars) {
      errors.push(`Malformed variable references: ${malformedVars.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract template variables
   */
  public static extractVariables(template: string): string[] {
    const variables = new Set<string>();
    
    // Extract simple variables
    const simpleVars = template.match(/\{\{([^#/][^}]*)\}\}/g);
    if (simpleVars) {
      simpleVars.forEach(match => {
        const variable = match.replace(/[{}]/g, '').trim();
        if (!variable.startsWith('@')) { // Exclude loop variables
          variables.add(variable);
        }
      });
    }

    // Extract condition variables
    const conditionVars = template.match(/\{\{#if\s+([^}]+)\}\}/g);
    if (conditionVars) {
      conditionVars.forEach(match => {
        const variable = match.replace(/\{\{#if\s+/, '').replace(/\}\}/, '').trim();
        variables.add(variable);
      });
    }

    // Extract loop variables  
    const loopVars = template.match(/\{\{#each\s+([^}]+)\}\}/g);
    if (loopVars) {
      loopVars.forEach(match => {
        const variable = match.replace(/\{\{#each\s+/, '').replace(/\}\}/, '').trim();
        variables.add(variable);
      });
    }

    return Array.from(variables).sort();
  }

  /**
   * Preview template with sample data
   */
  public static previewTemplate(template: string, sampleData: TemplateContext): string {
    try {
      return TemplateEngine.process(template, sampleData);
    } catch (error) {
      return `Template processing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}