import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import download_startech_desktop_images as desktop


class DesktopDownloaderTests(unittest.TestCase):
    def test_duplicate_labels_resolve_under_correct_parent(self):
        client = Mock()
        client.get_soup.return_value = BeautifulSoup('''
          <li><a class="nav-link" href="/desktops">Desktop</a><ul>
            <li><a class="nav-link" href="/desktops/star-pc">Star PC</a><ul>
              <li><a class="nav-link" href="/intel-pc">Intel PC</a></li>
            </ul></li>
            <li><a class="nav-link" href="/desktops/gaming-pc">Gaming PC</a><ul>
              <li><a class="nav-link" href="/desktops/gaming-pc/intel">Intel PC</a></li>
            </ul></li>
          </ul></li>''', 'html.parser')
        for parent, expected in [('Star PC', '/intel-pc'), ('Gaming PC', '/desktops/gaming-pc/intel')]:
            self.assertEqual(desktop.find_named_category_link(
                client, desktop.DESKTOP_URL, 'Intel PC', parent), desktop.BASE + expected)

    def test_pagination_deduplicates_and_checks_completeness(self):
        client = Mock()
        client.get_soup.side_effect = [BeautifulSoup(html, 'html.parser') for html in [
            '<p>Showing 1 to 2 of 3 (2 Pages)</p><h4><a href="/a">A</a></h4><h4><a href="/b">B</a></h4>',
            '<h4><a href="/b">B</a></h4><h4><a href="/c">C</a></h4>',
        ]]
        products, count = desktop.crawl_listing(client, desktop.DESKTOP_URL)
        self.assertEqual((len(products), count), (3, 3))
        self.assertEqual(client.get_soup.call_args.args[0], desktop.DESKTOP_URL + '?page=2')
        client.get_soup.side_effect = None
        client.get_soup.return_value = BeautifulSoup('<p>Showing 1 to 2 of 2 (1 Pages)</p><h4><a href="/a">A</a></h4>', 'html.parser')
        with self.assertRaisesRegex(RuntimeError, 'Incomplete catalog'):
            desktop.crawl_listing(client, desktop.DESKTOP_URL)

    def test_existing_image_skips_network_and_overwrite_replaces(self):
        client = Mock(delay=0)
        client.get_soup.return_value = BeautifulSoup('<meta property="og:image" content="/image/main.webp">', 'html.parser')
        response = client.get_image_response.return_value
        response.headers = {'content-type': 'image/webp'}
        response.iter_content.return_value = [b'new image']
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            target = folder / 'example.webp'
            target.write_bytes(b'old image')
            desktop.download_primary_image(client, desktop.BASE + '/example', 'Example', folder, overwrite=False)
            client.get_soup.assert_not_called()
            self.assertEqual(target.read_bytes(), b'old image')
            desktop.download_primary_image(client, desktop.BASE + '/example', 'Example', folder, overwrite=True)
            self.assertEqual(target.read_bytes(), b'new image')
            self.assertFalse(list(folder.glob('*.part')))


if __name__ == '__main__':
    unittest.main()
