using System.Linq;
using System.Collections.Generic;
namespace ResourceManager.Services
{
        public class FournisseurCache
        {
            private readonly object _sync = new();
            private readonly List<string> _fournisseurs = new();

            public IReadOnlyList<string> GetAll()
            {
                lock (_sync)
                {
                    return _fournisseurs.ToList();
                }
            }

            public void Initialize(IEnumerable<string> names)
            {
                lock (_sync)
                {
                _fournisseurs.Clear();
                    _fournisseurs.AddRange(names.Where(n => !string.IsNullOrWhiteSpace(n)).Distinct());
                }
            }

            public void Add(string name)
            {
                if (string.IsNullOrWhiteSpace(name)) return;
                lock (_sync)
                {
                    if (!_fournisseurs.Contains(name))
                        _fournisseurs.Add(name);
                }
            }

            public void Remove(string name)
            {
                if (string.IsNullOrWhiteSpace(name)) return;
                lock (_sync)
                {
                    _fournisseurs.Remove(name);
                }
            }
        }
}
