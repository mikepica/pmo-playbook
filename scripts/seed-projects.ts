import { connectToDatabase } from '../src/lib/mongodb';
import Project from '../src/models/Project';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function seedProjects() {
  try {
    await connectToDatabase();
    console.log('Connected to MongoDB');

    // Sample Project 1: Digital Transformation Initiative
    const project1 = new Project({
      projectId: 'PRO-001',
      projectName: 'Digital Transformation Initiative',
      sponsor: 'Sarah Johnson, CTO',
      projectTeam: [
        'Michael Chen - Project Manager',
        'Emily Rodriguez - Technical Lead',
        'David Kim - Business Analyst',
        'Lisa Wang - UX Designer',
        'James Wilson - DevOps Engineer'
      ],
      keyStakeholders: [
        'Executive Leadership Team',
        'IT Department Heads',
        'Finance Director',
        'Operations Manager',
        'Customer Service Manager'
      ],
      projectObjectives: [
        'Modernize legacy systems to cloud-based infrastructure',
        'Implement automated workflow processes across departments',
        'Reduce operational costs by 30% within 18 months',
        'Improve customer response time by 50%',
        'Establish data-driven decision making culture'
      ],
      businessCaseSummary: 'This digital transformation initiative aims to modernize our technology infrastructure and business processes to remain competitive in the digital age. The project will replace aging legacy systems with modern cloud-based solutions, automate manual processes, and provide real-time analytics capabilities. Expected benefits include reduced operational costs, improved customer satisfaction, and increased employee productivity. The investment of $2.5M is projected to yield a positive ROI within 24 months through cost savings and revenue growth.',
      resourceRequirements: 'Budget: $2.5 million over 18 months\nPersonnel: 5 FTE core team members, 15 part-time contributors from various departments\nTechnology: AWS cloud infrastructure, Salesforce CRM, Microsoft 365 suite, Power BI analytics\nExternal Consultants: Cloud migration specialists (6 months), Change management consultant (12 months)\nTraining Budget: $150,000 for staff upskilling and certification programs',
      scopeDeliverables: [
        'Cloud migration of core business applications',
        'Implementation of new CRM system',
        'Automated workflow system for 10 key business processes',
        'Real-time analytics dashboard for executives',
        'Mobile app for field service teams',
        'Comprehensive training program for all staff',
        'Updated IT security policies and procedures'
      ],
      keyDatesMilestones: [
        {
          date: new Date('2024-03-01'),
          description: 'Project kickoff and team onboarding'
        },
        {
          date: new Date('2024-06-30'),
          description: 'Phase 1: Legacy system assessment complete'
        },
        {
          date: new Date('2024-09-30'),
          description: 'Phase 2: Cloud infrastructure setup and initial migration'
        },
        {
          date: new Date('2024-12-31'),
          description: 'Phase 3: CRM implementation and data migration'
        },
        {
          date: new Date('2025-03-31'),
          description: 'Phase 4: Workflow automation rollout'
        },
        {
          date: new Date('2025-06-30'),
          description: 'Phase 5: Training completion and final go-live'
        }
      ],
      threats: [
        'Resistance to change from long-term employees',
        'Data security risks during migration',
        'Potential system downtime affecting operations',
        'Budget overruns due to unexpected technical challenges',
        'Vendor lock-in with cloud providers',
        'Skills gap in new technologies'
      ],
      opportunities: [
        'Establish company as industry leader in digital innovation',
        'Attract top talent with modern technology stack',
        'Enable new business models and revenue streams',
        'Improve partner integration capabilities',
        'Leverage AI/ML for predictive analytics',
        'Reduce carbon footprint through cloud efficiency'
      ],
      keyAssumptions: [
        'Executive sponsorship remains strong throughout project',
        'Current IT team can be upskilled for new technologies',
        'Business processes can be standardized across departments',
        'Cloud providers maintain 99.9% uptime SLA',
        'Regulatory compliance requirements remain stable'
      ],
      successCriteria: [
        'All legacy systems successfully migrated to cloud',
        '95% user adoption rate within 6 months',
        'Zero critical security incidents during migration',
        '30% reduction in IT operational costs achieved',
        'Customer satisfaction score improved by 20%',
        'Employee productivity increased by 25%'
      ],
      isActive: true
    });

    // Sample Project 2: Product Launch - AI Assistant Platform
    const project2 = new Project({
      projectId: 'PRO-002',
      projectName: 'AI Assistant Platform Launch',
      sponsor: 'Robert Martinez, VP of Product',
      projectTeam: [
        'Amanda Foster - Product Manager',
        'Kevin Liu - AI/ML Engineer Lead',
        'Rachel Green - Marketing Manager',
        'Tom Anderson - QA Lead',
        'Nina Patel - Customer Success Manager'
      ],
      keyStakeholders: [
        'CEO and Board of Directors',
        'Sales Leadership',
        'Engineering Department',
        'Marketing Team',
        'Key Beta Customers'
      ],
      projectObjectives: [
        'Develop and launch enterprise-grade AI assistant platform',
        'Capture 10% market share in first year',
        'Generate $5M in revenue within 12 months',
        'Establish partnerships with 3 major integration providers',
        'Build community of 1000+ active developers'
      ],
      businessCaseSummary: 'The AI Assistant Platform project will position our company at the forefront of the conversational AI market. By leveraging cutting-edge large language models and our proprietary training techniques, we will deliver a platform that enables businesses to build custom AI assistants tailored to their specific needs. The platform will offer superior accuracy, enterprise security features, and seamless integration capabilities that differentiate us from competitors. Initial market research indicates strong demand with potential for $50M+ annual revenue within 3 years.',
      resourceRequirements: 'Budget: $3.2 million for development and launch\nPersonnel: 8 FTE engineers, 3 product team members, 4 marketing specialists\nInfrastructure: GPU clusters for model training, Azure cloud deployment\nThird-party services: OpenAI API licensing, Anthropic partnerships\nMarketing budget: $500,000 for launch campaign\nLegal/Compliance: $100,000 for IP protection and regulatory compliance',
      scopeDeliverables: [
        'Core AI platform with API access',
        'Web-based dashboard for assistant management',
        'SDK for Python, JavaScript, and Java',
        'Pre-trained models for 5 industry verticals',
        'Comprehensive API documentation',
        'Enterprise security and compliance features',
        'Usage analytics and billing system',
        'Developer community portal'
      ],
      keyDatesMilestones: [
        {
          date: new Date('2024-02-15'),
          description: 'Alpha version development start'
        },
        {
          date: new Date('2024-05-01'),
          description: 'Private beta launch with 20 customers'
        },
        {
          date: new Date('2024-07-15'),
          description: 'Public beta release'
        },
        {
          date: new Date('2024-09-01'),
          description: 'GA (General Availability) launch'
        },
        {
          date: new Date('2024-10-15'),
          description: 'First partnership integrations live'
        },
        {
          date: new Date('2024-12-31'),
          description: 'Version 2.0 with advanced features'
        }
      ],
      threats: [
        'Rapid competition from tech giants',
        'AI regulation changes affecting deployment',
        'Model hallucination and accuracy concerns',
        'High computational costs affecting pricing',
        'Customer data privacy concerns',
        'Talent retention in competitive market'
      ],
      opportunities: [
        'First-mover advantage in enterprise AI assistant space',
        'Strategic acquisition potential by larger companies',
        'Expansion into international markets',
        'Development of industry-specific solutions',
        'Partnership opportunities with major SaaS providers',
        'Government contracts for secure AI solutions'
      ],
      keyAssumptions: [
        'AI technology continues to improve at current pace',
        'Enterprise demand for AI assistants grows as projected',
        'We can maintain competitive pricing while being profitable',
        'Key technical talent remains with the company',
        'No major security breaches affect market confidence'
      ],
      successCriteria: [
        '100+ paying enterprise customers by end of year 1',
        '$5M ARR achieved within 12 months',
        '99.9% platform uptime maintained',
        'Developer community reaches 1000+ active members',
        'Customer satisfaction (CSAT) score above 4.5/5',
        'Featured in Gartner Magic Quadrant'
      ],
      isActive: true
    });

    // Check if projects already exist
    const existingProject1 = await Project.findOne({ projectId: 'PRO-001' });
    const existingProject2 = await Project.findOne({ projectId: 'PRO-002' });

    if (!existingProject1) {
      await project1.save();
      console.log('✅ Created project: Digital Transformation Initiative (PRO-001)');
    } else {
      console.log('⚠️  Project PRO-001 already exists');
    }

    if (!existingProject2) {
      await project2.save();
      console.log('✅ Created project: AI Assistant Platform Launch (PRO-002)');
    } else {
      console.log('⚠️  Project PRO-002 already exists');
    }

    console.log('\n✨ Sample projects seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding projects:', error);
    process.exit(1);
  }
}

seedProjects();