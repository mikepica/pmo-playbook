'use client';

import { useState, useEffect } from 'react';
import { Search, FileText, ChevronRight, Home, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SOP {
  _id: string;
  sopId: string;
  title: string;
  phase: number;
  version: number;
  markdownContent: string;
  updatedAt: string;
}

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export default function SOPBrowser() {
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [tableOfContents, setTableOfContents] = useState<TOCItem[]>([]);
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    loadSOPs();
  }, []);

  useEffect(() => {
    if (selectedSOP) {
      generateTableOfContents(selectedSOP.markdownContent);
    }
  }, [selectedSOP]);

  useEffect(() => {
    if (selectedSOP) {
      const handleScroll = () => {
        const sections = document.querySelectorAll('h1, h2, h3');
        let currentSection = '';
        
        sections.forEach((section) => {
          const rect = section.getBoundingClientRect();
          if (rect.top <= 100) {
            currentSection = section.id;
          }
        });
        
        setActiveSection(currentSection);
      };

      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [selectedSOP]);

  const loadSOPs = async () => {
    try {
      const response = await fetch('/api/content-db?type=human&all=true');
      const data = await response.json();
      
      if (data.sops) {
        setSOPs(data.sops);
        if (data.sops.length > 0) {
          setSelectedSOP(data.sops[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load SOPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTableOfContents = (markdown: string) => {
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const toc: TOCItem[] = [];
    let match;
    
    while ((match = headingRegex.exec(markdown)) !== null) {
      const level = match[1].length;
      const text = match[2];
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      
      toc.push({ id, text, level });
    }
    
    setTableOfContents(toc);
  };

  const filteredSOPs = sops.filter(sop => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      sop.title.toLowerCase().includes(query) ||
      sop.markdownContent.toLowerCase().includes(query) ||
      sop.sopId.toLowerCase().includes(query)
    );
  });

  const highlightSearchResults = (content: string) => {
    if (!searchQuery) return content;
    
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    return content.replace(regex, '**$1**');
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SOPs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">PMO Playbook SOPs</h1>
              <span className="text-sm text-gray-500">{sops.length} procedures available</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                AI Assistant
              </Link>
              <Link
                href="/admin"
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Admin Panel
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-80 flex-shrink-0">
            <div className="sticky top-24">
              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search SOPs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* SOP List */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-900">All Procedures</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {filteredSOPs.map((sop) => (
                    <button
                      key={sop.sopId}
                      onClick={() => setSelectedSOP(sop)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        selectedSOP?.sopId === sop.sopId ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{sop.title}</h3>
                          <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                            <span>Phase {sop.phase}</span>
                            <span>•</span>
                            <span>{sop.sopId}</span>
                            <span>•</span>
                            <span>v{sop.version}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Table of Contents */}
              {selectedSOP && tableOfContents.length > 0 && (
                <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="font-semibold text-gray-900">Table of Contents</h2>
                  </div>
                  <div className="p-4">
                    <nav className="space-y-1">
                      {tableOfContents.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => scrollToSection(item.id)}
                          className={`block w-full text-left py-1 px-2 rounded text-sm hover:bg-gray-100 transition-colors ${
                            activeSection === item.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                          }`}
                          style={{ paddingLeft: `${(item.level - 1) * 1}rem` }}
                        >
                          {item.text}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {selectedSOP ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h1 className="text-3xl font-bold text-gray-900">{selectedSOP.title}</h1>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    <span className="flex items-center">
                      <FileText className="w-4 h-4 mr-1" />
                      {selectedSOP.sopId}
                    </span>
                    <span>Phase {selectedSOP.phase}</span>
                    <span>Version {selectedSOP.version}</span>
                    <span>Updated {new Date(selectedSOP.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="p-6 prose prose-lg max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({children, ...props}) => {
                        const id = children?.toString().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                        return <h1 id={id} className="text-3xl font-bold mb-4 text-black scroll-mt-20" {...props}>{children}</h1>;
                      },
                      h2: ({children, ...props}) => {
                        const id = children?.toString().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                        return <h2 id={id} className="text-2xl font-semibold mb-3 text-black scroll-mt-20" {...props}>{children}</h2>;
                      },
                      h3: ({children, ...props}) => {
                        const id = children?.toString().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                        return <h3 id={id} className="text-xl font-medium mb-2 text-black scroll-mt-20" {...props}>{children}</h3>;
                      },
                      p: ({...props}) => <p className="mb-4 text-gray-700 leading-relaxed" {...props} />,
                      ul: ({...props}) => <ul className="list-disc pl-6 mb-4 text-gray-700" {...props} />,
                      ol: ({...props}) => <ol className="list-decimal pl-6 mb-4 text-gray-700" {...props} />,
                      li: ({...props}) => <li className="mb-1 text-gray-700" {...props} />,
                      blockquote: ({...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4 text-gray-600" {...props} />,
                      code: ({...props}) => <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800" {...props} />,
                      pre: ({...props}) => <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4" {...props} />,
                      strong: ({...props}) => <strong className="font-bold text-gray-900" {...props} />,
                      em: ({...props}) => <em className="italic" {...props} />,
                      a: ({...props}) => <a className="text-blue-600 hover:text-blue-800 underline" {...props} />,
                      table: ({...props}) => <table className="w-full border-collapse border border-gray-300 mb-4" {...props} />,
                      th: ({...props}) => <th className="border border-gray-300 px-4 py-2 bg-gray-50 font-semibold text-left" {...props} />,
                      td: ({...props}) => <td className="border border-gray-300 px-4 py-2" {...props} />,
                      hr: ({...props}) => <hr className="my-8 border-gray-300" {...props} />,
                    }}
                  >
                    {highlightSearchResults(selectedSOP.markdownContent)}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select an SOP to view</h3>
                  <p className="text-gray-500">Choose from the list on the left or use the search to find specific content</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}