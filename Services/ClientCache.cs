using System.Linq;
using System.Collections.Generic;
namespace ResourceManager.Services
{
        public class ClientCache
        {
            private readonly object _sync = new();
            private readonly List<string> _clients = new();

            public IReadOnlyList<string> GetAll()
            {
                lock (_sync)
                {
                    return _clients.ToList();
                }
            }

            public void Initialize(IEnumerable<string> names)
            {
                lock (_sync)
                {
                    _clients.Clear();
                    _clients.AddRange(names.Where(n => !string.IsNullOrWhiteSpace(n)).Distinct());
                }
            }

            public void Add(string name)
            {
                if (string.IsNullOrWhiteSpace(name)) return;
                lock (_sync)
                {
                    if (!_clients.Contains(name))
                        _clients.Add(name);
                }
            }

            public void Remove(string name)
            {
                if (string.IsNullOrWhiteSpace(name)) return;
                lock (_sync)
                {
                    _clients.Remove(name);
                }
            }
        }
}
